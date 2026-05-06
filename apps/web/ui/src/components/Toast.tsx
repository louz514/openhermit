import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export type ToastVariant = 'info' | 'success' | 'error' | 'warning';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let idCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((arr) => arr.filter((t) => t.id !== id));
    const tid = timers.current.get(id);
    if (tid) { window.clearTimeout(tid); timers.current.delete(id); }
  }, []);

  const toast = useCallback<ToastContextValue['toast']>((message, variant = 'info', duration = 4500) => {
    const id = `t${++idCounter}`;
    setToasts((arr) => [...arr, { id, message, variant, duration }]);
    if (duration > 0) {
      const tid = window.setTimeout(() => dismiss(id), duration);
      timers.current.set(id, tid);
    }
  }, [dismiss]);

  useEffect(() => () => {
    for (const tid of timers.current.values()) window.clearTimeout(tid);
    timers.current.clear();
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.variant}`}>
            <span className="toast__icon" aria-hidden>
              {t.variant === 'success' && '✓'}
              {t.variant === 'error' && '✕'}
              {t.variant === 'warning' && '!'}
              {t.variant === 'info' && 'i'}
            </span>
            <span className="toast__message">{t.message}</span>
            <button
              type="button"
              className="toast__close"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback: no provider — log to console.
    return { toast: (msg, variant) => console[variant === 'error' ? 'error' : 'log'](msg) };
  }
  return ctx;
}
