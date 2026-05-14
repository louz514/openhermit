import { useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'auto';

const STORAGE_KEY = 'openhermit:theme:v1';

const isThemeMode = (v: string | null): v is ThemeMode =>
  v === 'light' || v === 'dark' || v === 'auto';

const readStoredTheme = (): ThemeMode => {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return isThemeMode(v) ? v : 'auto';
  } catch {
    return 'auto';
  }
};

const applyTheme = (mode: ThemeMode): void => {
  const root = document.documentElement;
  if (mode === 'auto') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', mode);
  }
};

// Ensure the document picks up the saved theme as early as possible.
// Called from main.tsx so the first paint is in the right colors.
export const initTheme = (): void => {
  applyTheme(readStoredTheme());
};

export const useTheme = (): [ThemeMode, (next: ThemeMode) => void] => {
  const [mode, setMode] = useState<ThemeMode>(readStoredTheme);

  useEffect(() => {
    applyTheme(mode);
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore — non-fatal
    }
  }, [mode]);

  return [mode, setMode];
};

const ICONS: Record<ThemeMode, string> = {
  light: '☀',
  dark: '☾',
  auto: '◐',
};

const NEXT: Record<ThemeMode, ThemeMode> = {
  light: 'dark',
  dark: 'auto',
  auto: 'light',
};

const LABEL: Record<ThemeMode, string> = {
  light: 'Light',
  dark: 'Dark',
  auto: 'Auto',
};

export function ThemeToggle() {
  const [mode, setMode] = useTheme();
  return (
    <button
      type="button"
      className="btn btn--ghost btn--sm theme-toggle"
      onClick={() => setMode(NEXT[mode])}
      title={`Theme: ${LABEL[mode]} (click to switch)`}
      aria-label={`Theme: ${LABEL[mode]}. Click to switch.`}
    >
      <span className="theme-toggle__icon" aria-hidden="true">{ICONS[mode]}</span>
      <span className="theme-toggle__label">{LABEL[mode]}</span>
    </button>
  );
}
