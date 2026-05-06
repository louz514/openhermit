import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react';

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
  pendingText?: string;
  onConsumePendingText?: () => void;
}

export function Composer({ onSend, disabled, pendingText, onConsumePendingText }: Props) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (pendingText && pendingText.length > 0) {
      setText(pendingText);
      onConsumePendingText?.();
      // focus the textarea so the user can hit Enter or edit
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      });
    }
  }, [pendingText, onConsumePendingText]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (disabled) return;
    const trimmed = text.trim();
    if (trimmed) {
      onSend(trimmed);
      setText('');
    }
  };

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <textarea
        ref={textareaRef}
        rows={3}
        placeholder="Ask OpenHermit to inspect files, run code, search memory, or continue a previous thread..."
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="composer__actions">
        <p className="composer__hint">
          <kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for newline
        </p>
        <button
          className="btn btn--primary composer__send"
          type="submit"
          disabled={disabled || !text.trim()}
          aria-label="Send message"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M22 2 11 13" />
            <path d="m22 2-7 20-4-9-9-4 20-7z" />
          </svg>
          <span>Send</span>
        </button>
      </div>
    </form>
  );
}
