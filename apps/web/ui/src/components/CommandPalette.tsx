import { useEffect, useRef, useState, useMemo, type ReactNode } from 'react';

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  group: string;
  action: () => void | Promise<void>;
  icon?: ReactNode;
  keywords?: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  commands: CommandItem[];
}

export function CommandPalette({ open, onClose, commands }: Props) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => {
      const haystack = [c.label, c.hint ?? '', c.group, ...(c.keywords ?? [])]
        .join(' ')
        .toLowerCase();
      return q.split(/\s+/).every((token) => haystack.includes(token));
    });
  }, [commands, query]);

  // Group filtered commands
  const grouped = useMemo(() => {
    const out: { group: string; items: CommandItem[] }[] = [];
    for (const item of filtered) {
      let bucket = out.find((g) => g.group === item.group);
      if (!bucket) { bucket = { group: item.group, items: [] }; out.push(bucket); }
      bucket.items.push(item);
    }
    return out;
  }, [filtered]);

  const flatList = filtered;

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  if (!open) return null;

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatList.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = flatList[activeIndex];
      if (cmd) {
        void cmd.action();
        onClose();
      }
    }
  };

  return (
    <div className="cmdk-backdrop" onClick={onClose}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="cmdk__input-wrap">
          <svg className="cmdk__search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            className="cmdk__input"
            placeholder="Search actions, sessions, settings…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
          />
          <kbd className="cmdk__kbd">esc</kbd>
        </div>
        <div className="cmdk__list">
          {flatList.length === 0 && (
            <div className="cmdk__empty">No matches for "{query}"</div>
          )}
          {grouped.map((g) => (
            <div key={g.group} className="cmdk__group">
              <div className="cmdk__group-label">{g.group}</div>
              {g.items.map((cmd) => {
                const idx = flatList.indexOf(cmd);
                const active = idx === activeIndex;
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    className={`cmdk__item${active ? ' is-active' : ''}`}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => { void cmd.action(); onClose(); }}
                  >
                    {cmd.icon && <span className="cmdk__icon">{cmd.icon}</span>}
                    <span className="cmdk__label">{cmd.label}</span>
                    {cmd.hint && <span className="cmdk__hint">{cmd.hint}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="cmdk__footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook that manages global cmd-k / ctrl-k toggle for the palette.
 */
export function useCommandPalette(): { open: boolean; setOpen: (v: boolean) => void } {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return { open, setOpen };
}
