// Single-source line-art icon set (lucide-style strokes, currentColor).
// Use <Icon name="..." size={16} /> in place of emojis so glyphs match the
// brand and stay legible across themes.

interface Props {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
  'aria-hidden'?: boolean;
}

export type IconName =
  | 'sparkle'
  | 'circle-dot'
  | 'power'
  | 'settings'
  | 'key'
  | 'message-square'
  | 'wand'
  | 'puzzle'
  | 'clock'
  | 'shield'
  | 'check-circle'
  | 'check'
  | 'x'
  | 'alert-triangle'
  | 'lightbulb'
  | 'door'
  | 'database'
  | 'box'
  | 'users'
  | 'wave'
  | 'folder'
  | 'brain'
  | 'sparkles'
  | 'home'
  | 'trash';

const PATHS: Record<IconName, JSX.Element> = {
  sparkle: <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" />,
  'circle-dot': (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    </>
  ),
  power: (
    <>
      <path d="M12 3v9" />
      <path d="M5.5 7.5a8 8 0 1 0 13 0" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  key: (
    <>
      <circle cx="7.5" cy="15.5" r="3.5" />
      <path d="M10 13 21 2" />
      <path d="m17 6 3 3" />
      <path d="m14 9 3 3" />
    </>
  ),
  'message-square': <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  wand: (
    <>
      <path d="m15 4-2 2" />
      <path d="m20 9-2 2" />
      <path d="M3 21 17 7" />
      <path d="m6 6 2-2" />
      <path d="m11 11 2-2" />
    </>
  ),
  puzzle: <path d="M19.43 12.98 12 20.41l-7.43-7.43a4 4 0 0 1 5.66-5.65L12 8.71l1.77-1.78a4 4 0 0 1 5.66 5.66z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  'check-circle': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  check: <path d="M5 12l4 4 10-10" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  'alert-triangle': (
    <>
      <path d="M10.3 3.7 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
  lightbulb: (
    <>
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.7c.7.6 1 1.4 1 2.3h6c0-.9.3-1.7 1-2.3A7 7 0 0 0 12 2z" />
    </>
  ),
  door: (
    <>
      <path d="M5 22V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v18" />
      <path d="M3 22h18" />
      <path d="M14 12h.01" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </>
  ),
  box: (
    <>
      <path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.3 7 12 12l8.7-5" />
      <path d="M12 22V12" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9" />
      <path d="M16 3.1A4 4 0 0 1 16 11" />
    </>
  ),
  wave: (
    <>
      <path d="M3 13c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      <path d="M3 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
    </>
  ),
  folder: <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />,
  brain: (
    <>
      <path d="M12 5a3 3 0 0 0-5.5 1.5A3 3 0 0 0 4 11a3 3 0 0 0 1 5.5A3 3 0 0 0 9.5 20 3 3 0 0 0 12 19" />
      <path d="M12 5a3 3 0 0 1 5.5 1.5A3 3 0 0 1 20 11a3 3 0 0 1-1 5.5A3 3 0 0 1 14.5 20 3 3 0 0 1 12 19" />
      <path d="M12 5v14" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
    </>
  ),
  home: (
    <>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v10h14V10" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
};

export function Icon({ name, size = 16, className, strokeWidth = 1.75, ...rest }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={rest['aria-hidden'] ?? true}
    >
      {PATHS[name]}
    </svg>
  );
}

// Small monogram brand mark — geometric "O" with a vertical accent stroke.
// Use anywhere we previously rendered the 🜲 alchemy glyph.
interface MarkProps {
  size?: number;
  className?: string;
}

export function BrandMark({ size = 28, className }: MarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="16" cy="16" r="11" />
      <path d="M16 6v20" />
      <path d="M9 16h14" />
    </svg>
  );
}
