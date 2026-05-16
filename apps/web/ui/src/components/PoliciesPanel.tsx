import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchPolicies,
  upsertPolicy,
  deletePolicy,
  fetchAgentSecurity,
  putAgentSecurity,
  type PolicyInfo,
  type AgentSecurityPolicy,
} from '../api';
import { useToast } from './Toast';

const GRANT_PRESETS: { label: string; grants: Array<{ type: 'any' | 'role'; value?: string }> }[] = [
  { label: 'Everyone', grants: [{ type: 'any' }] },
  { label: 'Owner only', grants: [{ type: 'role', value: 'owner' }] },
  { label: 'Owner + User', grants: [{ type: 'role', value: 'owner' }, { type: 'role', value: 'user' }] },
];

function grantsLabel(grants: PolicyInfo['grants']): string {
  if (grants.length === 0) return 'None (blocked)';
  if (grants.some((g) => g.type === 'any')) return 'Everyone';
  const roles = grants.filter((g) => g.type === 'role').map((g) => g.value);
  const users = grants.filter((g) => g.type === 'user').map((g) => g.value);
  const parts: string[] = [];
  if (roles.length) parts.push(roles.join(', '));
  if (users.length) parts.push(`user:${users.join(',')}`);
  return parts.join(' + ');
}

export function PoliciesPanel() {
  const { toast } = useToast();
  const [policies, setPolicies] = useState<PolicyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<PolicyInfo | null>(null);

  const load = useCallback(async () => {
    try {
      setPolicies(await fetchPolicies());
      setError('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleDelete = async (p: PolicyInfo) => {
    if (!window.confirm(`Delete policy for ${p.resourceType}/${p.resourceKey} [${p.effect}]?`)) return;
    const snapshot = policies;
    setPolicies((arr) => arr.filter((x) => x.id !== p.id));
    try {
      await deletePolicy(p.resourceType, p.resourceKey, p.effect);
      toast(`Deleted policy for ${p.resourceKey}`, 'success');
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast(`Failed to delete: ${msg}`, 'error');
      setPolicies(snapshot);
    }
  };

  if (loading) return <p className="manage__empty">Loading...</p>;

  return (
    <div className="policies-panel">
      <SharingSection />

      <div className="policies-panel__intro">
        <p className="eyebrow">Access Policies</p>
        <p className="policies-panel__hint">
          Override the default access level for tools. Each policy maps a tool
          name to a set of grants that control who can use it. Use <code>*</code> suffix
          for prefix matching (e.g. <code>mcp__weather__*</code> covers all tools
          from that MCP server). Tools without a custom policy use their built-in defaults.
        </p>
      </div>

      <div className="manage__toolbar">
        <button className="btn btn--sm btn--primary" onClick={() => setShowCreate(true)}>
          Add Policy
        </button>
      </div>

      {policies.length === 0 ? (
        <p className="manage__empty">No custom policies. All tools use built-in defaults.</p>
      ) : (
        <div className="policies-panel__list">
          {policies.map((p) => (
            <div className="policies-row" key={p.id}>
              <div className="policies-row__info">
                <span className="policies-row__key">{p.resourceKey}</span>
                <span className="policies-row__type">{p.resourceType}</span>
                <span className={`policies-row__effect policies-row__effect--${p.effect}`}>{p.effect}</span>
                {p.scope && Object.keys(p.scope).length > 0 && (
                  <span className="policies-row__scope">{JSON.stringify(p.scope)}</span>
                )}
              </div>
              <div className="policies-row__grants">{grantsLabel(p.grants)}</div>
              <div className="policies-row__actions">
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => setEditing(p)}
                >
                  Edit
                </button>
                <button
                  className="btn btn--ghost btn--sm policies-row__delete"
                  onClick={() => void handleDelete(p)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="basic-panel__error">{error}</p>}

      {showCreate && (
        <CreatePolicyDialog
          onClose={() => setShowCreate(false)}
          onSaved={(msg) => { toast(msg, 'success'); void load(); }}
        />
      )}

      {editing && (
        <CreatePolicyDialog
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => { toast(msg, 'success'); void load(); }}
        />
      )}
    </div>
  );
}

function CreatePolicyDialog({
  existing,
  onClose,
  onSaved,
}: {
  existing?: PolicyInfo;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [resourceKey, setResourceKey] = useState(existing?.resourceKey ?? '');
  const [effect, setEffect] = useState<'allow' | 'deny' | 'require_approval'>(
    (existing?.effect as 'allow' | 'deny' | 'require_approval') ?? 'allow',
  );

  // Try to map an existing policy's grants back onto a preset; fall back to
  // custom JSON if the shape doesn't match any preset cleanly.
  const matchedPreset = existing
    ? GRANT_PRESETS.findIndex(
        (p) => JSON.stringify(p.grants) === JSON.stringify(existing.grants),
      )
    : 2;
  const initialUseCustom = existing != null && matchedPreset === -1;

  const [preset, setPreset] = useState(matchedPreset === -1 ? 2 : matchedPreset);
  const [customGrants, setCustomGrants] = useState(
    initialUseCustom ? JSON.stringify(existing!.grants, null, 2) : '',
  );
  const [useCustom, setUseCustom] = useState(initialUseCustom);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { dialogRef.current?.showModal(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = resourceKey.trim();
    if (!key) return;

    let grants: Array<{ type: string; value?: string }>;
    if (useCustom) {
      try {
        grants = JSON.parse(customGrants);
        if (!Array.isArray(grants)) throw new Error();
      } catch {
        setErr('Grants must be a valid JSON array');
        return;
      }
    } else {
      grants = GRANT_PRESETS[preset]!.grants;
    }

    setBusy(true);
    setErr('');
    try {
      await upsertPolicy({ resourceType: 'tool', resourceKey: key, effect, grants });
      onClose();
      onSaved(existing ? `Updated policy for ${key}` : `Added policy for ${key}`);
    } catch (error) {
      setErr((error as Error).message);
      setBusy(false);
    }
  };

  return (
    <dialog ref={dialogRef} className="manage__dialog" onClose={onClose}>
      <form className="manage__dialog-form" onSubmit={handleSubmit}>
        <h3>{existing ? 'Edit Tool Policy' : 'Add Tool Policy'}</h3>
        <label className="manage__field">
          <span className="manage__field-label">Tool name</span>
          <input
            className="manage__field-input"
            required
            value={resourceKey}
            onChange={(e) => setResourceKey(e.target.value)}
            placeholder="e.g. exec, file_write, mcp__server__*"
            disabled={busy || existing != null}
          />
          {existing && (
            <span className="field__help">Resource key cannot be changed; delete and re-create to rename.</span>
          )}
        </label>

        <label className="manage__field">
          <span className="manage__field-label">Effect</span>
          <select
            className="manage__field-input"
            value={effect}
            onChange={(e) => setEffect(e.target.value as 'allow' | 'deny' | 'require_approval')}
            disabled={busy}
          >
            <option value="allow">Allow</option>
            <option value="deny">Deny</option>
            <option value="require_approval">Require Approval</option>
          </select>
        </label>

        <fieldset className="manage__field" style={{ border: 'none', padding: 0, margin: 0 }}>
          <span className="manage__field-label">Grants (who this rule targets)</span>
          <div className="manage__radio-group">
            {GRANT_PRESETS.map((p, i) => (
              <label key={i}>
                <input
                  type="radio"
                  name="preset"
                  checked={!useCustom && preset === i}
                  onChange={() => { setPreset(i); setUseCustom(false); }}
                  disabled={busy}
                />
                {p.label}
              </label>
            ))}
            <label>
              <input
                type="radio"
                name="preset"
                checked={useCustom}
                onChange={() => setUseCustom(true)}
                disabled={busy}
              />
              Custom JSON
            </label>
          </div>
        </fieldset>

        {useCustom && (
          <label className="manage__field">
            <span className="manage__field-label">Custom grants JSON</span>
            <textarea
              className="manage__field-input manage__field-textarea"
              rows={3}
              value={customGrants}
              onChange={(e) => setCustomGrants(e.target.value)}
              placeholder='[{"type":"role","value":"owner"},{"type":"user","value":"u-123"}]'
              disabled={busy}
            />
          </label>
        )}

        {err && <p className="basic-panel__error">{err}</p>}

        <div className="manage__dialog-actions">
          <button className="btn btn--ghost" type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn--primary" type="submit" disabled={busy}>
            {busy ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </dialog>
  );
}

// Generate a URL-safe random token using the Web Crypto API.
function randomToken(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  let binary = '';
  for (const b of arr) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function SharingSection() {
  const { toast } = useToast();
  const [policy, setPolicy] = useState<AgentSecurityPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setPolicy(await fetchAgentSecurity());
      setError('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async (patch: Partial<AgentSecurityPolicy>) => {
    if (!policy) return;
    const next = { ...policy, ...patch };
    setSaving(true);
    try {
      await putAgentSecurity(next);
      setPolicy(next);
      toast('Sharing settings updated', 'success');
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast(`Failed to update: ${msg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAccessChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    void save({ access: e.target.value as AgentSecurityPolicy['access'] });
  };

  const handleGenerate = () => {
    void save({ access_token: randomToken() });
  };

  const handleClearToken = () => {
    if (!window.confirm('Clear the share token? Anyone who already has it will no longer be able to join.')) return;
    void save({ access_token: '' });
  };

  const handleCopy = async () => {
    if (!policy?.access_token) return;
    try {
      await navigator.clipboard.writeText(policy.access_token);
      toast('Token copied to clipboard', 'success');
    } catch {
      toast('Copy failed — select the token and copy manually', 'error');
    }
  };

  if (loading) return <p className="manage__empty">Loading sharing…</p>;
  if (!policy) return null;

  const access = policy.access ?? 'public';
  const token = policy.access_token ?? '';

  return (
    <div className="policies-panel__intro" style={{ marginBottom: 16 }}>
      <p className="eyebrow">Sharing</p>
      <p className="policies-panel__hint">
        Controls who can chat with this agent.{' '}
        <strong>Public</strong> auto-creates guest members on first contact.{' '}
        <strong>Protected</strong> requires the share token below.{' '}
        <strong>Private</strong> only allows members you add explicitly.
      </p>

      <div className="basic-panel__field" style={{ marginTop: 8 }}>
        <label>Access level</label>
        <select value={access} onChange={handleAccessChange} disabled={saving}>
          <option value="public">Public — anyone can chat</option>
          <option value="protected">Protected — share token required</option>
          <option value="private">Private — owner-added members only</option>
        </select>
      </div>

      {access === 'protected' && (
        <div className="basic-panel__field" style={{ marginTop: 8 }}>
          <label>Share token</label>
          {token ? (
            <>
              <div className="basic-panel__custom-row">
                <input type="text" value={token} readOnly onFocus={(e) => e.currentTarget.select()} />
                <button type="button" className="btn btn--sm btn--ghost" onClick={() => void handleCopy()}>
                  Copy
                </button>
              </div>
              <div className="basic-panel__actions" style={{ marginTop: 8 }}>
                <button type="button" className="btn btn--sm btn--ghost" onClick={handleGenerate} disabled={saving}>
                  Regenerate
                </button>
                <button type="button" className="btn btn--sm btn--ghost" onClick={handleClearToken} disabled={saving}>
                  Clear
                </button>
              </div>
              <p className="basic-panel__hint">
                Share this token with someone you want to invite. They paste it on the “Join existing agent” screen along with the agent ID.
              </p>
            </>
          ) : (
            <>
              <button type="button" className="btn btn--sm btn--primary" onClick={handleGenerate} disabled={saving}>
                Generate share token
              </button>
              <p className="basic-panel__hint">No token yet — generate one to let others self-join.</p>
            </>
          )}
        </div>
      )}

      {error && <p className="basic-panel__error">{error}</p>}
    </div>
  );
}
