import { useState, useEffect, type FormEvent } from 'react';
import {
  exchangeToken,
  getDeviceFingerprint,
  getDisplayName,
  importDeviceKey,
  isNewDevice,
  loadGatewayUrl,
  probeGateway,
  saveGatewayUrl,
  setDisplayName,
  setGateway,
  type GatewayReadiness,
} from '../api';
import { BrandMark } from './Icon';

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
/**
 * Heuristic: if the user is loading the web UI from a non-gateway port
 * (the typical dev setup is web=:4310, gateway=:4000), suggest the
 * gateway origin instead of the web origin so first-time users don't
 * accidentally connect to themselves.
 */
const suggestGatewayUrl = (): string => {
  if (typeof window === 'undefined') return 'http://localhost:4000';
  const origin = window.location.origin;
  try {
    const url = new URL(origin);
    // Common dev port for the end-user web UI; gateway lives on :4000.
    if (url.port === '4310' || url.port === '5173') {
      url.port = '4000';
      return url.toString().replace(/\/+$/, '');
    }
  } catch {
    /* fall through */
  }
  return origin;
};

export function SetupScreen({ onComplete }: Props) {
  const [fingerprint, setFingerprint] = useState('');
  const [gatewayUrl, setGatewayUrl] = useState(loadGatewayUrl() ?? suggestGatewayUrl());
  const [name, setName] = useState(getDisplayName() ?? '');
  const [isNew, setIsNew] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [mode, setMode] = useState<'new' | 'restore'>('new');
  const [restoreKey, setRestoreKey] = useState('');
  // Pre-flight probe state. We hit /api/readiness on the gateway URL once
  // the user pauses typing so they see misconfigurations (no DATABASE_URL,
  // ephemeral JWT secret, etc.) BEFORE the auth POST blows up with a
  // generic 500.
  const [probe, setProbe] = useState<
    | { state: 'idle' }
    | { state: 'checking' }
    | { state: 'ok'; readiness: GatewayReadiness }
    | { state: 'warn'; readiness: GatewayReadiness }
    | { state: 'error'; message: string; readiness?: GatewayReadiness }
  >({ state: 'idle' });

  useEffect(() => {
    (async () => {
      const fp = await getDeviceFingerprint();
      setFingerprint(fp);
      setIsNew(isNewDevice());
      setLoading(false);
    })();
  }, []);

  // Debounced gateway probe. Skip while the field is empty or obviously
  // mid-edit (no protocol).
  useEffect(() => {
    const url = gatewayUrl.trim();
    if (!url || !/^https?:\/\//.test(url)) {
      setProbe({ state: 'idle' });
      return;
    }
    setProbe({ state: 'checking' });
    let cancelled = false;
    const t = window.setTimeout(async () => {
      const result = await probeGateway(url);
      if (cancelled) return;
      if (result.kind === 'unreachable') {
        setProbe({ state: 'error', message: result.message });
      } else if (result.kind === 'misconfigured') {
        setProbe({ state: 'error', readiness: result.readiness, message: result.readiness.hints[0] ?? 'Gateway is not ready.' });
      } else {
        // Even when ok, surface non-blocking warnings (ephemeral JWT, no
        // secrets key) so the operator can fix them between sessions.
        const hasWarnings = result.readiness.hints.length > 0;
        setProbe(hasWarnings
          ? { state: 'warn', readiness: result.readiness }
          : { state: 'ok', readiness: result.readiness });
      }
    }, 350);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [gatewayUrl]);

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
    <div className="center-screen welcome-bg">
      <form className="card card--form welcome-card" onSubmit={handleSubmit}>
        <div className="welcome-hero">
          <div className="welcome-logo"><BrandMark size={32} /></div>
          <p className="eyebrow">OpenHermit</p>
          <h1>{isNew ? 'Welcome aboard' : 'Sign back in'}</h1>
          <p className="hint hint--center">
            {mode === 'restore'
              ? 'Paste a device key you previously exported to restore access on this browser.'
              : isNew
              ? 'OpenHermit is your control plane for AI agents. Tell us your gateway and what to call you — we\'ll do the rest.'
              : 'Reconnecting this device to your gateway.'}
          </p>
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

        {mode === 'new' && (
          <label className="field">
            <span className="field__label">Display name</span>
            <input
              className="field__input"
              type="text"
              placeholder="What should agents call you?"
              required
              autoFocus={isNew}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}

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
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, resize: 'vertical' }}
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
            placeholder="http://localhost:4000"
            required
            value={gatewayUrl}
            onChange={(e) => setGatewayUrl(e.target.value)}
          />
          <span className="field__help">
            The OpenHermit gateway. Default for local dev: <code>http://localhost:4000</code>.
          </span>
        </label>

        {probe.state === 'checking' && (
          <p className="probe probe--checking">Checking gateway…</p>
        )}
        {probe.state === 'error' && (
          <div className="probe probe--error">
            <strong>Gateway not ready.</strong> {probe.message}
            {probe.readiness && probe.readiness.hints.length > 1 && (
              <ul>
                {probe.readiness.hints.slice(1).map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {probe.state === 'warn' && (
          <div className="probe probe--warn">
            <strong>Gateway reachable.</strong> A few things to fix when convenient:
            <ul>
              {probe.readiness.hints.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </div>
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
            ? 'Connecting…'
            : mode === 'restore'
            ? 'Restore device'
            : isNew
            ? 'Get started'
            : 'Continue'}
        </button>

        <button
          type="button"
          className="welcome-toggle"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? 'Hide device details' : 'What is this device key?'}
        </button>
        {showAdvanced && (
          <div className="welcome-advanced">
            <p className="hint">
              Your browser generated a private key that proves this device's identity. The
              gateway never sees the private half — only a fingerprint. No passwords, no
              email magic links, just this device.
            </p>
            <div className="device-key-display">
              <span className="field__label">Device key fingerprint</span>
              <code className="device-key-value">{shortFp}</code>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
