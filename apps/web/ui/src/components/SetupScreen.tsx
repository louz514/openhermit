import { useState, useEffect, type FormEvent } from 'react';
import {
  exchangeToken,
  getDeviceFingerprint,
  getDisplayName,
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
    const dn = name.trim();
    if (!url || !dn) return;
    setError('');
    setSubmitting(true);
    try {
      setDisplayName(dn);
      saveGatewayUrl(url);
      setGateway(url);
      await exchangeToken(dn);
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
          <div className="welcome-logo">🜲</div>
          <p className="eyebrow">OpenHermit</p>
          <h1>{isNew ? 'Welcome aboard' : 'Sign back in'}</h1>
          <p className="hint hint--center">
            {isNew
              ? 'OpenHermit is your control plane for AI agents. Tell us your gateway and what to call you — we\'ll do the rest.'
              : 'Reconnecting this device to your gateway.'}
          </p>
        </div>

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

        {error && <p className="form-error">{error}</p>}

        <button
          className="btn btn--primary btn--full"
          type="submit"
          disabled={!name.trim() || !gatewayUrl.trim() || submitting}
        >
          {submitting ? 'Connecting…' : isNew ? 'Get started' : 'Continue'}
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
