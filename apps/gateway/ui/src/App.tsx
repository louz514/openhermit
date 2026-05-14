import { useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';
import { useTabRouter } from './router';
import { AuthScreen } from './components/AuthScreen';
import { Topbar } from './components/Topbar';
import { FleetPanel } from './components/FleetPanel';
import { SkillsPanel } from './components/SkillsPanel';
import { McpServersPanel } from './components/McpServersPanel';
import { SchedulesPanel } from './components/SchedulesPanel';
import { ChannelsPanel } from './components/ChannelsPanel';
import { SandboxesPanel } from './components/SandboxesPanel';
import { UsersPanel } from './components/UsersPanel';
import { StatsPanel } from './components/StatsPanel';
import { LogsPanel } from './components/LogsPanel';
import { GatewayConfigPanel } from './components/GatewayConfigPanel';
import { Walkthrough, walkthroughStorage } from './components/Walkthrough';

export function App() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useTabRouter();
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      setChecking(false);
      return;
    }
    api('/api/admin/stats')
      .then(() => setAuthed(true))
      .catch(() => setToken(''))
      .finally(() => setChecking(false));
  }, []);

  // Auto-open the tour the first time an authed user lands on the admin UI.
  useEffect(() => {
    if (authed && !walkthroughStorage.isDismissed()) {
      setTourOpen(true);
    }
  }, [authed]);

  const handleSignIn = async (t: string) => {
    setToken(t);
    await api('/api/admin/stats');
    setAuthed(true);
  };

  const handleSignOut = () => {
    setToken('');
    setAuthed(false);
  };

  if (checking) return null;

  if (!authed) {
    return <AuthScreen onSignIn={handleSignIn} />;
  }

  return (
    <div className="shell">
      <Topbar
        tab={tab}
        onTabChange={setTab}
        onSignOut={handleSignOut}
        onOpenTour={() => setTourOpen(true)}
      />
      {tab === 'fleet' && <FleetPanel />}
      {tab === 'skills' && <SkillsPanel />}
      {tab === 'mcp-servers' && <McpServersPanel />}
      {tab === 'schedules' && <SchedulesPanel />}
      {tab === 'channels' && <ChannelsPanel />}
      {tab === 'sandboxes' && <SandboxesPanel />}
      {tab === 'users' && <UsersPanel />}
      {tab === 'stats' && <StatsPanel />}
      {tab === 'logs' && <LogsPanel />}
      {tab === 'config' && <GatewayConfigPanel />}
      <Walkthrough
        open={tourOpen}
        onClose={(opts) => {
          if (opts?.dontShowAgain) walkthroughStorage.setDismissed(true);
          setTourOpen(false);
        }}
        onTabChange={setTab}
      />
    </div>
  );
}
