import { lazy, Suspense, useEffect, useState } from 'react';
import {
  loadConnection,
  loadGatewayUrl,
  saveConnection,
  clearConnection,
  setConnection,
  setGateway,
  initJwt,
  exchangeToken,
  getDisplayName,
  listMyAgents,
  type Connection,
} from './api';
import { PickAgentScreen } from './components/PickAgentScreen';
import { SetupScreen } from './components/SetupScreen';
// LandingScreen is static marketing content — lazy-load so returning
// users on Setup/PickAgent/Chat don't pay for it.
const LandingScreen = lazy(() =>
  import('./components/LandingScreen').then((m) => ({ default: m.LandingScreen })),
);
// ChatShell pulls in the markdown + KaTeX stack — keep it out of the
// initial bundle for users still on Setup/PickAgent.
const ChatShell = lazy(() => import('./components/ChatShell').then((m) => ({ default: m.ChatShell })));
import { ToastProvider } from './components/Toast';
import { useTheme } from './components/ThemeToggle';

type Screen = 'landing' | 'setup' | 'pick-agent' | 'chat';

export function App() {
  // Initialize theme on mount.
  useTheme();

  // Render landing immediately so first paint isn't blocked by JWT
  // refresh. The async effect below upgrades `resumeTarget` (and the CTA
  // label) once we know whether the visitor can resume chat / agents.
  const [screen, setScreen] = useState<Screen>('landing');
  const [connection, setConn] = useState<Connection | null>(null);
  const [gatewayUrl, setGatewayUrl] = useState<string>('');
  // Where the landing-page CTA should send the user.
  const [resumeTarget, setResumeTarget] = useState<Exclude<Screen, 'landing'>>('setup');

  useEffect(() => {
    let cancelled = false;
    initJwt();

    const displayName = getDisplayName();
    const savedGateway = loadGatewayUrl();

    // First-time visitor: nothing to resume — landing → setup.
    if (!displayName || !savedGateway) {
      return;
    }
    setGateway(savedGateway);
    setGatewayUrl(savedGateway);

    // Returning visitor: silently refresh JWT, then decide whether the
    // landing CTA should jump to the previous chat, the agent picker,
    // or fall back to setup if the device key was rejected.
    (async () => {
      try {
        await exchangeToken(displayName);
      } catch {
        return;
      }
      if (cancelled) return;

      const saved = loadConnection();
      if (saved?.agentId) {
        let role = saved.role;
        try {
          const memberships = await listMyAgents();
          if (cancelled) return;
          const m = memberships.find((x) => x.agentId === saved.agentId);
          if (!m) {
            setResumeTarget('pick-agent');
            return;
          }
          role = m.role;
        } catch {
          // fall through with stored role
        }
        if (cancelled) return;
        const fresh: Connection = { ...saved, ...(role ? { role } : {}) };
        setConn(fresh);
        setConnection(fresh);
        saveConnection(fresh);
        setResumeTarget('chat');
      } else {
        setResumeTarget('pick-agent');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSetupComplete = (): void => {
    const url = loadGatewayUrl();
    if (url) setGatewayUrl(url);
    setScreen('pick-agent');
  };

  const handlePickAgent = async (conn: Connection): Promise<void> => {
    setConnection(conn);
    saveConnection(conn);
    setConn(conn);
    setScreen('chat');
  };

  const handleDisconnect = (): void => {
    clearConnection();
    setConn(null);
    setScreen('pick-agent');
  };

  const handleSignOut = (): void => {
    clearConnection();
    localStorage.removeItem('openhermit_jwt');
    localStorage.removeItem('openhermit_gateway_url');
    setConn(null);
    setScreen('landing');
  };

  if (screen === 'landing') {
    return (
      <ToastProvider>
        <Suspense fallback={null}>
          <LandingScreen
            resumeTarget={resumeTarget}
            onGetStarted={() => setScreen(resumeTarget)}
          />
        </Suspense>
      </ToastProvider>
    );
  }

  if (screen === 'setup') {
    return (
      <ToastProvider>
        <SetupScreen onComplete={handleSetupComplete} />
      </ToastProvider>
    );
  }

  if (screen === 'pick-agent') {
    return (
      <ToastProvider>
        <PickAgentScreen
          gatewayUrl={gatewayUrl}
          onPick={handlePickAgent}
          onSignOut={handleSignOut}
        />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <Suspense fallback={null}>
        <ChatShell
          connection={connection!}
          role={connection?.role ?? null}
          onDisconnect={handleDisconnect}
          onGoHome={() => setScreen('landing')}
        />
      </Suspense>
    </ToastProvider>
  );
}
