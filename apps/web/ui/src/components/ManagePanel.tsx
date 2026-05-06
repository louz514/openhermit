import { BasicPanel } from './BasicPanel';
import { SecretsPanel } from './SecretsPanel';
import { SkillsPanel } from './SkillsPanel';
import { McpPanel } from './McpPanel';
import { SchedulesPanel } from './SchedulesPanel';
import { ChannelsPanel } from './ChannelsPanel';
import { PoliciesPanel } from './PoliciesPanel';
import { ApprovalsPanel } from './ApprovalsPanel';

export type ManageTab = 'basic' | 'secrets' | 'skills' | 'mcp' | 'schedules' | 'channels' | 'policies' | 'approvals';

interface TabDef {
  id: ManageTab;
  label: string;
  icon: string;
  description: string;
}

const tabs: TabDef[] = [
  { id: 'basic', label: 'Basic', icon: '⚙️', description: 'Model, workspace, and core agent configuration.' },
  { id: 'secrets', label: 'Secrets', icon: '🔑', description: 'API keys and tokens. Encrypted at rest, scoped to this agent.' },
  { id: 'channels', label: 'Channels', icon: '💬', description: 'Connect Telegram, Discord, Slack, and other inbound surfaces.' },
  { id: 'skills', label: 'Skills', icon: '🛠', description: 'Reusable capability packages. Enable per agent or fleet-wide.' },
  { id: 'mcp', label: 'MCP', icon: '🧩', description: 'Model Context Protocol servers exposing external tool collections.' },
  { id: 'schedules', label: 'Schedules', icon: '⏰', description: 'Cron and one-shot jobs with timeout and concurrency policy.' },
  { id: 'policies', label: 'Policies', icon: '🛡', description: 'Tool access controls and approval requirements.' },
  { id: 'approvals', label: 'Approvals', icon: '✋', description: 'Pending tool calls awaiting your decision.' },
];

interface Props {
  tab: ManageTab;
  onTabChange: (tab: ManageTab) => void;
}

export function ManagePanel({ tab, onTabChange }: Props) {
  const active = tabs.find((t) => t.id === tab);
  return (
    <div className="manage">
      <div className="manage__tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`manage__tab${tab === t.id ? ' active' : ''}`}
            onClick={() => onTabChange(t.id)}
            title={t.description}
          >
            <span className="manage__tab-icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      {active && (
        <p className="manage__description">{active.description}</p>
      )}
      <div className="manage__content">
        {tab === 'basic' && <BasicPanel />}
        {tab === 'secrets' && <SecretsPanel />}
        {tab === 'skills' && <SkillsPanel />}
        {tab === 'mcp' && <McpPanel />}
        {tab === 'schedules' && <SchedulesPanel />}
        {tab === 'channels' && <ChannelsPanel />}
        {tab === 'policies' && <PoliciesPanel />}
        {tab === 'approvals' && <ApprovalsPanel />}
      </div>
    </div>
  );
}
