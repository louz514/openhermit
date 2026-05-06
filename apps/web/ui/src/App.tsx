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
import { useTheme } from './components/ThemeToggle';

type Screen = 'loading' | 'landing' | 'setup' | 'pick-agent' | 'chat';

export function App() {
  // Initialize theme on mount.
  useTheme();

  const [screen, setScreen] = useState<Screen>('loading');
  const [connection, setConn] = useState<Connection | null>(null);
  const [gatewayUrl, setGatewayUrl] = useState<string>('');

  useEffect(() => {
    initJwt();

    // Need both display name AND a remembered gateway URL to skip setup.
    const displayName = getDisplayName();
    const savedGateway = loadGatewayUrl();
    if (!displayName || !savedGateway) {
      // First-time visitors land on the marketing page; returning users
      // who only cleared one of the two go straight to setup.
      setScreen(displayName || savedGateway ? 'setup' : 'landing');
      return;
    }
    setGateway(savedGateway);
    setGatewayUrl(savedGateway);

    // Try to refresh the JWT silently. If the device key is still valid
    // for this gateway we go straight to agent picker / last chat.
    (async () => {
      try {
        await exchangeToken(displayName);
      } catch {
        setScreen('setup');
        return;
      }

      const saved = loadConnection();
      if (saved?.agentId) {
        // Refresh role from server — it may have changed since last visit.
        let role = saved.role;
        try {
          const memberships = await listMyAgents();
          const m = memberships.find((x) => x.agentId === saved.agentId);
          if (!m) {
            setScreen('pick-agent');
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
        setScreen('chat');
      } else {
        setScreen('pick-agent');
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
        <LandingScreen onGetStarted={() => setScreen('setup')} />
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
        />
      </Suspense>
    </ToastProvider>
  );
}
