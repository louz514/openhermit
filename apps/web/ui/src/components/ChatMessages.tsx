import { memo, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { marked, type TokenizerExtension, type RendererExtension } from 'marked';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import remend from 'remend';
import DOMPurify from 'dompurify';
import { apiFetch } from '../api';

// ─── KaTeX extension for marked ────────────────────────────────────────────

const mathInline: TokenizerExtension & RendererExtension = {
  name: 'mathInline',
  level: 'inline',
  start(src: string) { return src.indexOf('$'); },
  tokenizer(src: string) {
    const match = src.match(/^\$([^\$\n]+?)\$/);
    if (match) {
      return { type: 'mathInline', raw: match[0], text: match[1] };
    }
    return undefined;
  },
  renderer(token) {
    try {
      return katex.renderToString(token.text, { throwOnError: false });
    } catch {
      return token.raw;
    }
  },
};

const mathBlock: TokenizerExtension & RendererExtension = {
  name: 'mathBlock',
  level: 'block',
  start(src: string) { return src.indexOf('$$'); },
  tokenizer(src: string) {
    const match = src.match(/^\$\$([\s\S]+?)\$\$/);
    if (match) {
      return { type: 'mathBlock', raw: match[0], text: match[1].trim() };
    }
    return undefined;
  },
  renderer(token) {
    try {
      return `<div class="math-block">${katex.renderToString(token.text, { throwOnError: false, displayMode: true })}</div>`;
    } catch {
      return `<pre>${token.raw}</pre>`;
    }
  },
};

marked.use({ extensions: [mathBlock, mathInline] });

// ─── Markdown renderer ─────────────────────────────────────────────────────

// Allow common markdown/KaTeX output but strip <script>, event handlers, and
// unsafe URI schemes. Agent output is untrusted; never inject raw HTML.
const SANITIZE_CONFIG: DOMPurify.Config = {
  ADD_TAGS: ['math', 'mrow', 'mi', 'mo', 'mn', 'ms', 'mtext', 'mfrac', 'msqrt', 'mroot', 'msub', 'msup', 'msubsup', 'munder', 'mover', 'munderover', 'mtable', 'mtr', 'mtd', 'semantics', 'annotation'],
  ADD_ATTR: ['target', 'rel'],
  FORBID_TAGS: ['style'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onmouseenter', 'onmouseleave'],
};

const renderMarkdown = (text: string, streaming = false): string => {
  const src = streaming ? remend(text, { linkMode: 'text-only' }) : text;
  const raw = marked.parse(src, { async: false }) as string;
  return DOMPurify.sanitize(raw, SANITIZE_CONFIG);
};

// Memoized markdown wrapper. Marked + KaTeX + DOMPurify is non-trivial work
// per render; this skips re-parsing whenever the parent re-renders without a
// real text/streaming change (the common case during streaming sibling
// messages).
const MarkdownBlock = memo(function MarkdownBlock({
  text,
  streaming,
  className,
}: { text: string; streaming: boolean; className: string }) {
  const html = useMemo(() => renderMarkdown(text, streaming), [text, streaming]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
});

// ─── Types ─────────────────────────────────────────────────────────────────

export type ChatItem =
  | { type: 'user'; text: string; streaming: false; name?: string }
  | { type: 'assistant'; text: string; streaming: boolean; name?: string }
  | { type: 'event'; text: string; isError: boolean }
  | { type: 'tool'; tool: string; toolCallId?: string; args?: unknown; phase: 'running' | 'done'; isError?: boolean; result?: string }
  | { type: 'approval'; toolName: string; toolCallId: string; args?: unknown; resolved: boolean; approved?: boolean }
  | { type: 'thinking'; text?: string; streaming?: boolean }
  | { type: 'introspection'; tools: Extract<ChatItem, { type: 'tool' }>[]; summary?: string };

interface Props {
  items: ChatItem[];
  agentName?: string;
  loading?: boolean;
  onApproval: (toolCallId: string, approved: boolean) => Promise<void>;
  emptyState?: React.ReactNode;
}

// ─── Components ────────────────────────────────────────────────────────────

function ToolCard({ item }: { item: Extract<ChatItem, { type: 'tool' }> }) {
  const [expanded, setExpanded] = useState(false);
  const icon = item.phase === 'done'
    ? (item.isError ? '✗' : '✓')
    : (item.phase === 'running' ? '●' : '○');
  const statusLabel = item.phase === 'done'
    ? (item.isError ? 'error' : 'done')
    : item.phase;

  const doneClass = item.phase === 'done' ? (item.isError ? 'tool-card--error' : 'tool-card--done') : '';

  const formatArgs = (value: unknown): string => {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    const compact = JSON.stringify(value);
    return compact.length <= 120 ? compact : JSON.stringify(value, null, 2);
  };

  const hasBody = item.args != null || item.result;

  return (
    <details className={`tool-card ${doneClass}`} open={item.phase !== 'done'}>
      <summary className="tool-card__header">
        <span className="tool-card__label">Tool:</span>
        <span className="tool-card__name">{item.tool}</span>
        <span
          className={`tool-card__icon${item.phase === 'done' ? (item.isError ? ' tool-card__icon--error' : ' tool-card__icon--done') : ''}`}
          aria-label={statusLabel}
          title={statusLabel}
        >
          {icon}
        </span>
      </summary>
      {hasBody && (
        <div className="tool-card__body">
          {item.args != null && (
            <pre className="tool-card__args">{formatArgs(item.args)}</pre>
          )}
          {item.result && (
            <>
              <pre className="tool-card__result">
                {expanded || item.result.length <= 800
                  ? item.result
                  : item.result.slice(0, 800) + '…'}
              </pre>
              {item.result.length > 800 && (
                <button
                  type="button"
                  className="tool-card__expand"
                  onClick={(e) => { e.preventDefault(); setExpanded((v) => !v); }}
                >
                  {expanded
                    ? 'Show less'
                    : `Show full output (${item.result.length.toLocaleString()} chars)`}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </details>
  );
}

function ApprovalCard({ item, onApproval }: { item: Extract<ChatItem, { type: 'approval' }>; onApproval: Props['onApproval'] }) {
  if (item.resolved) {
    return (
      <div className="event">
        {item.approved ? `[approved] ${item.toolName}` : `[denied] ${item.toolName}`}
      </div>
    );
  }

  const formatArgs = (value: unknown): string => {
    if (value === undefined || value === null) return 'No arguments';
    if (typeof value === 'string') return value;
    return JSON.stringify(value, null, 2);
  };

  return (
    <div className="approval-card">
      <div className="approval-card__title">Approval required · {item.toolName}</div>
      <div className="approval-card__body">{formatArgs(item.args)}</div>
      <div className="approval-card__actions">
        <button className="btn btn--primary" onClick={() => void onApproval(item.toolCallId, true)}>Approve</button>
        <button className="btn btn--ghost" onClick={() => void onApproval(item.toolCallId, false)}>Deny</button>
      </div>
    </div>
  );
}

// ─── Turn grouping ────────────────────────────────────────────────────────

type Turn =
  | { kind: 'user'; items: Extract<ChatItem, { type: 'user' }>[] }
  | { kind: 'assistant'; items: ChatItem[] }
  | { kind: 'event'; item: Extract<ChatItem, { type: 'event' }> }
  | { kind: 'introspection'; item: Extract<ChatItem, { type: 'introspection' }> };

const isAssistantItem = (item: ChatItem) =>
  item.type === 'assistant' || item.type === 'tool' || item.type === 'approval' || item.type === 'thinking';

function groupIntoTurns(items: ChatItem[]): Turn[] {
  const turns: Turn[] = [];
  for (const item of items) {
    if (item.type === 'user') {
      turns.push({ kind: 'user', items: [item] });
    } else if (item.type === 'event') {
      turns.push({ kind: 'event', item });
    } else if (item.type === 'introspection') {
      turns.push({ kind: 'introspection', item });
    } else if (isAssistantItem(item)) {
      const last = turns[turns.length - 1];
      if (last?.kind === 'assistant') {
        last.items.push(item);
      } else {
        turns.push({ kind: 'assistant', items: [item] });
      }
    }
  }
  return turns;
}

// ─── Main ──────────────────────────────────────────────────────────────────

export function ChatMessages({ items, agentName, loading, onApproval, emptyState }: Props) {
  const containerRef = useRef<HTMLElement>(null);
  const displayAgentName = agentName || 'Assistant';
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  // Track whether the user has scrolled away from the bottom. We auto-scroll
  // only when they are near the bottom; otherwise we surface a "jump to
  // latest" pill so new messages don't yank them away from older history.
  const isPinnedToBottomRef = useRef(true);

  const isNearBottom = useCallback((el: HTMLElement) => {
    const threshold = 80; // px
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const near = isNearBottom(el);
      isPinnedToBottomRef.current = near;
      setShowJumpToLatest(!near);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [isNearBottom]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (isPinnedToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    } else {
      // New content arrived while user is reading history — keep the pill visible.
      setShowJumpToLatest(true);
    }
  }, [items]);

  const jumpToLatest = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    isPinnedToBottomRef.current = true;
    setShowJumpToLatest(false);
  }, []);

  // Hooks must run unconditionally — keep this above the early returns
  // below or React will throw "Rendered more hooks than during the
  // previous render" the moment loading flips to false / items arrives.
  const turns = useMemo(() => groupIntoTurns(items), [items]);

  if (loading) {
    return (
      <section className="chat__messages" ref={containerRef}>
        <div className="empty-state">Loading session history<span className="thinking-dots" /></div>
      </section>
    );
  }

  if (items.length === 0) {
    if (emptyState) return <>{emptyState}</>;
    return (
      <section className="chat__messages" ref={containerRef}>
        <div className="empty-state">Start a conversation or select a session from the sidebar.</div>
      </section>
    );
  }

  return (
    <section className="chat__messages" ref={containerRef}>
      {turns.map((turn, ti) => {
        if (turn.kind === 'user') {
          const item = turn.items[0];
          return (
            <article key={ti} className="message message--user">
              <div className="message__title">{item.name || 'You'}</div>
              <div className="message__body">{item.text}</div>
            </article>
          );
        }

        if (turn.kind === 'event') {
          return (
            <div key={ti} className={`event${turn.item.isError ? ' event--error' : ''}`}>
              {turn.item.isError ? `[error] ${turn.item.text}` : turn.item.text}
            </div>
          );
        }

        if (turn.kind === 'introspection') {
          const { tools, summary } = turn.item;
          return (
            <details key={ti} className="introspection-block">
              <summary className="introspection-block__header">
                Introspection{summary ? ` — ${summary}` : ''}
              </summary>
              <div className="introspection-block__body">
                {tools.map((tool, ii) => <ToolCard key={ii} item={tool} />)}
              </div>
            </details>
          );
        }

        const nameItem = turn.items.find(i => i.type === 'assistant' && i.name);
        const turnName = (nameItem as any)?.name || displayAgentName;

        return (
          <article key={ti} className="message message--assistant">
            <div className="message__title">{turnName}</div>
            {turn.items.map((item, ii) => {
              switch (item.type) {
                case 'assistant':
                  return (
                    <MarkdownBlock
                      key={ii}
                      text={item.text}
                      streaming={item.streaming}
                      className="message__body"
                    />
                  );
                case 'tool':
                  return <ToolCard key={ii} item={item} />;
                case 'approval':
                  return <ApprovalCard key={ii} item={item} onApproval={onApproval} />;
                case 'thinking':
                  return item.text ? (
                    <details key={ii} className="thinking-block" open={item.streaming}>
                      <summary className="thinking-block__header">
                        {item.streaming ? <>Thinking<span className="thinking-dots" /></> : 'Thinking'}
                      </summary>
                      <MarkdownBlock
                        text={item.text}
                        streaming={item.streaming ?? false}
                        className="thinking-block__body"
                      />
                    </details>
                  ) : (
                    <div key={ii} className="message__body thinking-indicator">Thinking<span className="thinking-dots" /></div>
                  );
              }
            })}
          </article>
        );
      })}
      {showJumpToLatest && (
        <button
          type="button"
          className="chat__jump-to-latest"
          onClick={jumpToLatest}
          aria-label="Jump to latest message"
        >
          ↓ New messages
        </button>
      )}
    </section>
  );
}
