import { useCallback, useEffect, useState } from 'react';
import { fetchAgentMembers, type AgentMemberInfo } from '../api';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function identityLabel(channel: string, channelUserId: string): string {
  if (channel === 'web' && channelUserId.startsWith('device:')) {
    return `web · device ${channelUserId.slice('device:'.length).slice(0, 8)}…`;
  }
  return `${channel} · ${channelUserId}`;
}

export function MembersPanel() {
  const [members, setMembers] = useState<AgentMemberInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMembers(await fetchAgentMembers());
      setError('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <p className="manage__empty">Loading members…</p>;

  return (
    <div className="policies-panel">
      <div className="policies-panel__intro">
        <p className="eyebrow">Members</p>
        <p className="policies-panel__hint">
          Everyone with access to this agent, across every channel they’ve used.
        </p>
      </div>

      <div className="manage__toolbar">
        <button className="btn btn--sm btn--ghost" onClick={() => void load()}>Refresh</button>
      </div>

      {error && <p className="basic-panel__error">{error}</p>}

      {members.length === 0 ? (
        <p className="manage__empty">No members yet.</p>
      ) : (
        <div className="policies-panel__list">
          {members.map((m) => (
            <div className="policies-row" key={m.userId}>
              <div className="policies-row__info">
                <span className="policies-row__key">{m.displayName || m.userId}</span>
                <span className={`policies-row__effect policies-row__effect--${m.role === 'owner' ? 'allow' : m.role === 'user' ? 'require_approval' : 'deny'}`}>
                  {m.role}
                </span>
                <span className="policies-row__type">joined {formatDate(m.createdAt)}</span>
              </div>
              <div className="policies-row__grants">
                {m.identities.length === 0
                  ? <span className="muted">no identities</span>
                  : m.identities.map((i, idx) => (
                      <span key={`${i.channel}:${i.channelUserId}:${idx}`} style={{ marginRight: 8 }}>
                        {identityLabel(i.channel, i.channelUserId)}
                      </span>
                    ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
