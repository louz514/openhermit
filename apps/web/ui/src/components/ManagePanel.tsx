import { lazy, Suspense } from 'react';
import { BasicPanel } from './BasicPanel';
import { Icon, type IconName } from './Icon';
import { confirmDiscardIfDirty } from './dirty-state';

// Each sub-panel pulls its own data + components on first open. BasicPanel
// stays eager because it's the default tab.
const SecretsPanel = lazy(() => import('./SecretsPanel').then((m) => ({ default: m.SecretsPanel })));
const SkillsPanel = lazy(() => import('./SkillsPanel').then((m) => ({ default: m.SkillsPanel })));
const McpPanel = lazy(() => import('./McpPanel').then((m) => ({ default: m.McpPanel })));
const SchedulesPanel = lazy(() => import('./SchedulesPanel').then((m) => ({ default: m.SchedulesPanel })));
const ChannelsPanel = lazy(() => import('./ChannelsPanel').then((m) => ({ default: m.ChannelsPanel })));
const PoliciesPanel = lazy(() => import('./PoliciesPanel').then((m) => ({ default: m.PoliciesPanel })));
const ApprovalsPanel = lazy(() => import('./ApprovalsPanel').then((m) => ({ default: m.ApprovalsPanel })));
const MembersPanel = lazy(() => import('./MembersPanel').then((m) => ({ default: m.MembersPanel })));

export type ManageTab = 'basic' | 'secrets' | 'skills' | 'mcp' | 'schedules' | 'channels' | 'policies' | 'members' | 'approvals';

interface TabDef {
  id: ManageTab;
  label: string;
  icon: IconName;
  description: string;
}

const tabs: TabDef[] = [
  { id: 'basic', label: 'Basic', icon: 'settings', description: 'Model, workspace, and core agent configuration.' },
  { id: 'secrets', label: 'Secrets', icon: 'key', description: 'API keys and tokens. Encrypted at rest, scoped to this agent.' },
  { id: 'channels', label: 'Apps', icon: 'message-square', description: 'Connect Telegram, Discord, Slack, and other places people can message your agent.' },
  { id: 'skills', label: 'Abilities', icon: 'wand', description: 'Reusable capability packages \u2014 enable per agent or across your fleet.' },
  { id: 'mcp', label: 'Integrations', icon: 'puzzle', description: 'External tool servers (Model Context Protocol) your agent can call out to.' },
  { id: 'schedules', label: 'Tasks', icon: 'clock', description: 'Recurring or one-off jobs the agent runs on a schedule.' },
  { id: 'policies', label: 'Permissions', icon: 'shield', description: 'Control which tools the agent can use, and which require your approval first.' },
  { id: 'members', label: 'Members', icon: 'users', description: 'People who can chat with this agent, across every channel.' },
  { id: 'approvals', label: 'Pending requests', icon: 'check-circle', description: 'Tool calls waiting for you to approve or deny.' },
];

interface Props {
  tab: ManageTab;
  onTabChange: (tab: ManageTab) => void;
}

export function ManagePanel({ tab, onTabChange }: Props) {
  const active = tabs.find((t) => t.id === tab);
  const requestTab = (next: ManageTab) => {
    if (next === tab) return;
    if (!confirmDiscardIfDirty()) return;
    onTabChange(next);
  };
  return (
    <div className="manage">
      <div className="manage__tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`manage__tab${tab === t.id ? ' active' : ''}`}
            onClick={() => requestTab(t.id)}
            title={t.description}
          >
            <span className="manage__tab-icon"><Icon name={t.icon} size={16} /></span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      {active && (
        <p className="manage__description">{active.description}</p>
      )}
      <div className="manage__content">
        {tab === 'basic' && <BasicPanel />}
        {tab !== 'basic' && (
          <Suspense fallback={<div className="manage__loading">Loading…</div>}>
            {tab === 'secrets' && <SecretsPanel />}
            {tab === 'skills' && <SkillsPanel />}
            {tab === 'mcp' && <McpPanel />}
            {tab === 'schedules' && <SchedulesPanel />}
            {tab === 'channels' && <ChannelsPanel />}
            {tab === 'policies' && <PoliciesPanel />}
            {tab === 'members' && <MembersPanel />}
            {tab === 'approvals' && <ApprovalsPanel />}
          </Suspense>
        )}
      </div>
    </div>
  );
}
