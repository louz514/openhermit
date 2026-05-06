import { useState, useEffect, type FormEvent } from 'react';
import {
  exchangeToken,
  getDeviceFingerprint,
  getDisplayName,
  importDeviceKey,
  isNewDevice,
  loadGatewayUrl,
  saveGatewayUrl,
  setDisplayName,
  setGateway,
} from '../api';

interface Props {
  onComplete: () => void;
}

/**
 * Step 1 — gateway connect.
 *
 * Generates a per-device ECDSA key (if not already), asks for the
 * gateway URL + display name, exchanges the device key for a
 * gateway-level JWT. The JWT has no agent in it; agent selection is
 * step 2 (PickAgentScreen).
 */
export function SetupScreen({ onComplete }: Props) {
  const [fingerprint, setFingerprint] = useState('');
  const [gatewayUrl, setGatewayUrl] = useState(loadGatewayUrl() ?? window.location.origin);
  const [name, setName] = useState(getDisplayName() ?? '');
  const [isNew, setIsNew] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'new' | 'restore'>('new');
  const [restoreKey, setRestoreKey] = useState('');

  useEffect(() => {
    (async () => {
      const fp = await getDeviceFingerprint();
      setFingerprint(fp);
      setIsNew(isNewDevice());
      setLoading(false);
    })();
  }, []);

  const shortFp = fingerprint
    ? `${fingerprint.slice(0, 8)}...${fingerprint.slice(-8)}`
    : '';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const url = gatewayUrl.trim().replace(/\/+$/, '');
    if (!url) return;
    setError('');
    setSubmitting(true);
    try {
      saveGatewayUrl(url);
      setGateway(url);
      if (mode === 'restore') {
        const ok = importDeviceKey(restoreKey.trim());
        if (!ok) throw new Error('That doesn\'t look like a valid device key. Paste the full JSON you exported.');
        // Use the imported display name if present, otherwise fall back to
        // whatever the user typed (or the existing one).
        const importedName = getDisplayName();
        const dn = importedName || name.trim();
        if (!dn) throw new Error('Display name is required.');
        if (!importedName) setDisplayName(dn);
        await exchangeToken(dn);
      } else {
        const dn = name.trim();
        if (!dn) throw new Error('Display name is required.');
        setDisplayName(dn);
        await exchangeToken(dn);
      }
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;

  return (
    <div className="center-screen">
      <form className="card card--form" onSubmit={handleSubmit}>
        <p className="eyebrow">OpenHermit</p>
        <h1>{isNew ? 'Welcome' : 'Connect to Gateway'}</h1>
        <p className="hint">
          {mode === 'restore'
            ? 'Paste a device key you previously exported to restore access on this browser.'
            : isNew
            ? 'A new device key has been generated for this browser. Tell us where the gateway is and what to call you.'
            : 'Sign in to your gateway with this device key.'}
        </p>

        <div className="device-key-display">
          <span className="field__label">Device Key Fingerprint</span>
          <code className="device-key-value">{shortFp}</code>
        </div>

        <div className="welcome-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'new'}
            className={`welcome-tab${mode === 'new' ? ' welcome-tab--active' : ''}`}
            onClick={() => { setMode('new'); setError(''); }}
          >
            New device
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'restore'}
            className={`welcome-tab${mode === 'restore' ? ' welcome-tab--active' : ''}`}
            onClick={() => { setMode('restore'); setError(''); }}
          >
            Restore from key
          </button>
        </div>

        {mode === 'restore' && (
          <label className="field">
            <span className="field__label">Device key (JSON)</span>
            <textarea
              className="field__input"
              rows={6}
              placeholder='{"publicKey":{…},"privateKey":{…},"displayName":"…"}'
              required
              value={restoreKey}
              onChange={(e) => setRestoreKey(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
            />
            <span className="field__help">
              Paste the full JSON you copied from <strong>Show access tokens → Device key</strong> on
              another browser. Display name will be restored from the file.
            </span>
          </label>
        )}

        <label className="field">
          <span className="field__label">Gateway URL</span>
          <input
            className="field__input"
            type="url"
            placeholder="https://hermit.example.com"
            required
            value={gatewayUrl}
            onChange={(e) => setGatewayUrl(e.target.value)}
          />
        </label>

        {mode === 'new' && (
          <label className="field">
            <span className="field__label">Display Name</span>
            <input
              className="field__input"
              type="text"
              placeholder="Your name"
              required
              autoFocus={isNew}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}

        {error && <p className="form-error">{error}</p>}

        <button
          className="btn btn--primary btn--full"
          type="submit"
          disabled={
            !gatewayUrl.trim() ||
            submitting ||
            (mode === 'new' && !name.trim()) ||
            (mode === 'restore' && !restoreKey.trim())
          }
        >
          {submitting
            ? 'Connecting...'
            : mode === 'restore'
            ? 'Restore device'
            : isNew
            ? 'Get started'
            : 'Continue'}
        </button>
      </form>
    </div>
  );
}
