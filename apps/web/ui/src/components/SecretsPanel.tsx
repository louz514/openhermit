import { useEffect, useState } from 'react';
import { fetchAgentSecrets, setAgentSecret, deleteAgentSecret } from '../api';
import { useToast } from './Toast';

interface RowState {
  key: string;
  /** Server-supplied masked preview. */
  masked: string;
  /** Current edit-in-progress value; empty until the user types. */
  draft: string;
  /** This row is currently mid-PUT/DELETE. */
  busy: boolean;
}

export function SecretsPanel() {
  const { toast } = useToast();
  const [rows, setRows] = useState<RowState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [adding, setAdding] = useState(false);

  const loadFromServer = async () => {
    const map = await fetchAgentSecrets();
    setRows(
      Object.keys(map).sort().map((k) => ({
        key: k,
        masked: map[k] ?? '',
        draft: '',
        busy: false,
      })),
    );
  };

  useEffect(() => {
    loadFromServer()
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const updateRow = (key: string, patch: Partial<RowState>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const saveRow = async (key: string) => {
    const row = rows.find((r) => r.key === key);
    if (!row || row.draft === '') return;
    setError('');
    updateRow(key, { busy: true });
    try {
      await setAgentSecret(key, row.draft);
      toast(`Saved ${key}`, 'success');
      await loadFromServer();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast(`Failed to save ${key}: ${msg}`, 'error');
      updateRow(key, { busy: false });
    }
  };

  const deleteRow = async (key: string) => {
    setError('');
    // Secrets are referenced by name from agent config (`${KEY}` interpolation
    // in api keys, channel tokens, MCP server urls, etc.) and tasks. We can't
    // reliably know from the client whether `key` is in use, so warn the
    // owner before destructive action.
    const confirmed = window.confirm(
      `Delete secret "${key}"?\n\n` +
      `If anything is currently referencing this secret (provider API key, ` +
      `channel token, MCP server, schedule), it will start failing the next ` +
      `time it's used. This can't be undone.`,
    );
    if (!confirmed) return;
    // Optimistic: remove the row immediately, restore on failure.
    const snapshot = rows;
    setRows((rs) => rs.filter((r) => r.key !== key));
    try {
      await deleteAgentSecret(key);
      toast(`Deleted ${key}`, 'success');
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast(`Failed to delete ${key}: ${msg}`, 'error');
      setRows(snapshot);
    }
  };

  const addNew = async () => {
    const k = newKey.trim();
    if (!k) return;
    if (rows.some((r) => r.key === k)) {
      setError(`Secret "${k}" already exists`);
      return;
    }
    setError('');
    setAdding(true);
    try {
      await setAgentSecret(k, newValue);
      toast(`Added ${k}`, 'success');
      setNewKey('');
      setNewValue('');
      await loadFromServer();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast(`Failed to add ${k}: ${msg}`, 'error');
    } finally {
      setAdding(false);
    }
  };

  if (loading) return <p className="manage__empty">Loading…</p>;
  if (error && rows.length === 0) return <p className="manage__empty">{error}</p>;

  return (
    <div className="secrets-panel">
      <div className="secrets-panel__intro">
        <p className="eyebrow">Secrets</p>
        <p className="secrets-panel__hint">
          Provider API keys, channel tokens, and other credentials. Existing
          values are never returned to the browser; the placeholder shows how
          the server has masked the current value. Each row saves
          independently — type a new value and click <strong>Save</strong> on
          that row, or <strong>Delete</strong> to remove the secret.
        </p>
      </div>

      <div className="secrets-panel__list">
        {rows.length === 0 ? (
          <p className="manage__empty">No secrets configured yet.</p>
        ) : (
          rows.map((r) => (
            <div className="secrets-row" key={r.key}>
              <span className="secrets-row__key">{r.key}</span>
              <input
                type="text"
                className="secrets-row__value"
                value={r.draft}
                onChange={(e) => updateRow(r.key, { draft: e.target.value })}
                placeholder={r.masked || 'unchanged'}
                disabled={r.busy}
                autoComplete="off"
              />
              <div className="secrets-row__actions">
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  disabled={r.busy || r.draft === ''}
                  onClick={() => void saveRow(r.key)}
                >
                  {r.busy ? '…' : 'Save'}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm secrets-row__delete"
                  disabled={r.busy}
                  onClick={() => {
                    if (window.confirm(`Delete secret "${r.key}"?`)) void deleteRow(r.key);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="secrets-panel__add">
        <input
          type="text"
          placeholder="Key (e.g. ANTHROPIC_API_KEY)"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          disabled={adding}
        />
        <input
          type="password"
          placeholder="Value"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          disabled={adding}
        />
        <button
          type="button"
          className="btn btn--primary"
          disabled={adding || !newKey.trim()}
          onClick={() => void addNew()}
        >
          {adding ? '…' : 'Add'}
        </button>
      </div>

      {error && <p className="basic-panel__error">{error}</p>}
    </div>
  );
}
