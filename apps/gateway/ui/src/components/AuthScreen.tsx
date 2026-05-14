import { FormEvent, useState } from 'react';

export function AuthScreen({ onSignIn }: { onSignIn: (token: string) => Promise<void> }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSignIn(token.trim());
    } catch (err) {
      setError(`Authentication failed: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <form className="auth-form" onSubmit={handleSubmit}>
        <p className="eyebrow">OpenHermit</p>
        <h1>Welcome</h1>
        <p className="auth-form__intro">
          Sign in to manage your agents, channels, skills, and more.
        </p>
        <label className="field">
          <span className="field__label">Admin token</span>
          <input
            className="field__input"
            type="password"
            placeholder="paste your admin token"
            required
            autoFocus
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </label>
        <p className="auth-form__hint">
          This is the value of <code>GATEWAY_ADMIN_TOKEN</code> from your
          gateway's <code>.env</code> file. New here?{' '}
          <a
            href="https://github.com/HCF-S/openhermit#quick-start"
            target="_blank"
            rel="noreferrer noopener"
          >
            Quick-start guide
          </a>.
        </p>
        {error && <p className="auth-form__error">{error}</p>}
        <button className="btn btn--primary" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
