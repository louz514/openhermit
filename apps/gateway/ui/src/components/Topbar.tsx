import { useEffect, useState } from 'react';
import type { Tab } from '../router';

function ThemeToggleAdmin() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const v = (typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : null) as 'dark' | 'light' | null;
    return v ?? 'dark';
  });
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('oh:theme', next); } catch { /* ignore */ }
  };
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      className="topbar__theme"
      onClick={toggle}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

const tabs: { id: Tab; label: string }[] = [
  { id: 'fleet', label: 'Agents' },
  { id: 'skills', label: 'Skills' },
  { id: 'mcp-servers', label: 'MCP' },
  { id: 'schedules', label: 'Schedules' },
  { id: 'channels', label: 'Channels' },
  { id: 'sandboxes', label: 'Sandboxes' },
  { id: 'users', label: 'Users' },
  { id: 'stats', label: 'Stats' },
  { id: 'logs', label: 'Logs' },
];

export function Topbar({
  tab,
  onTabChange,
  onSignOut,
}: {
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  onSignOut: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('.topbar')) setMenuOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [menuOpen]);

  const pickTab = (id: Tab) => {
    onTabChange(id);
    setMenuOpen(false);
  };

  return (
    <nav className="topbar">
      <a
        className="topbar__brand"
        href="/admin/fleet"
        aria-label="OpenHermit"
        onClick={(e) => {
          e.preventDefault();
          pickTab('fleet');
        }}
      >
        <img className="topbar__logo" src="/admin/logo.svg" alt="" width="22" height="22" />
        <span className="topbar__brand-text">openhermit</span>
      </a>

      <button
        className="topbar__hamburger"
        aria-label="Toggle menu"
        aria-expanded={menuOpen}
        onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
      >
        <span /><span /><span />
      </button>

      <div className={`topbar__tabs${menuOpen ? ' topbar__tabs--open' : ''}`}>
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`tab${tab === t.id ? ' active' : ''}`}
            onClick={() => pickTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <button className="btn btn--ghost btn--sm topbar__signout" onClick={() => { setMenuOpen(false); onSignOut(); }}>
          Sign Out
        </button>
      </div>

      <button className="btn btn--ghost btn--sm topbar__signout-desktop" onClick={onSignOut}>
        Sign Out
      </button>
      <ThemeToggleAdmin />
    </nav>
  );
}
