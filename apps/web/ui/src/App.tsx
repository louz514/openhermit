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
import { LandingScreen } from './components/LandingScreen';
// ChatShell pulls in the markdown + KaTeX stack — keep it out of the
// initial bundle for users still on Setup/PickAgent.
const ChatShell = lazy(() => import('./components/ChatShell').then((m) => ({ default: m.ChatShell })));
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useTheme } from './components/ThemeToggle';

type Screen = 'loading' | 'landing' | 'setup' | 'pick-agent' | 'chat';

export function App() {
  // Initialize theme on mount.
  useTheme();

  const [screen, setScreen] = useState<Screen>('loading');
  const [connection, setConn] = useState<Connection | null>(null);
  const [gatewayUrl, setGatewayUrl] = useState<string>('');
  // Where the landing-page CTA should send the user.
  const [resumeTarget, setResumeTarget] = useState<Exclude<Screen, 'landing' | 'loading'>>('setup');

  useEffect(() => {
    initJwt();

    const displayName = getDisplayName();
    const savedGateway = loadGatewayUrl();

    // First-time visitor: nothing to resume — landing → setup.
    if (!displayName || !savedGateway) {
      setResumeTarget('setup');
      setScreen('landing');
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
        setResumeTarget('setup');
        setScreen('landing');
        return;
      }

      const saved = loadConnection();
      if (saved?.agentId) {
        let role = saved.role;
        try {
          const memberships = await listMyAgents();
          const m = memberships.find((x) => x.agentId === saved.agentId);
          if (!m) {
            setResumeTarget('pick-agent');
            setScreen('landing');
            return;
          }
          role = m.role;
        } catch {
          // fall through with stored role
        }
        const fresh: Connection = { ...saved, ...(role ? { role } : {}) };
        setConn(fresh);
        setConnection(fresh);
        saveConnection(fresh);
        setResumeTarget('chat');
      } else {
        setResumeTarget('pick-agent');
      }
      // If the user landed deep-linked on a /chat/* URL and we already
      // have a usable connection, skip the landing flash and jump
      // straight to the chat. Otherwise fall back to the landing page so
      // returning visitors can choose where to go next.
      const onChatRoute = window.location.pathname.startsWith('/chat');
      if (onChatRoute && saved?.agentId) {
        setScreen('chat');
      } else {
        setScreen('landing');
      }
    })();
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

  if (screen === 'loading') return null;

  if (screen === 'landing') {
    return (
      <ToastProvider>
        <LandingScreen
          resumeTarget={resumeTarget}
          onGetStarted={() => setScreen(resumeTarget)}
        />
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
      <ErrorBoundary label="App">
        <Suspense fallback={null}>
          <ChatShell
            connection={connection!}
            role={connection?.role ?? null}
            onDisconnect={handleDisconnect}
            onGoHome={() => setScreen('landing')}
          />
        </Suspense>
      </ErrorBoundary>
    </ToastProvider>
  );
}
