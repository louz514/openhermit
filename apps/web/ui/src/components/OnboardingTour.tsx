import { useEffect, useState } from 'react';

const STORAGE_KEY = 'oh:tour:completed:v1';

interface Step {
  selector: string;
  title: string;
  body: string;
  align?: 'left' | 'right' | 'top';
}

const STEPS: Step[] = [
  {
    selector: '.sidebar__list',
    title: 'Sessions live here',
    body:
      'Each conversation is a session — they\'re saved forever. Click "New Session" to start a fresh thread, or click any past session to resume it.',
    align: 'left',
  },
  {
    selector: '.composer',
    title: 'Talk to your agent',
    body:
      'Type anything. The agent can read files, run code, browse the web, and use any tools or skills you\'ve enabled.',
    align: 'top',
  },
  {
    selector: '[data-tour="manage"]',
    title: 'Configure everything from here',
    body:
      'As an owner, this opens the Manage panel: secrets, skills, MCP servers, schedules, channels, and policies — all in one place.',
    align: 'left',
  },
];

interface Props {
  enabled: boolean;
  onDismiss: () => void;
}

export function OnboardingTour({ enabled, onDismiss }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const update = () => {
      const step = STEPS[stepIndex];
      if (!step) return;
      const el = document.querySelector(step.selector) as HTMLElement | null;
      setRect(el ? el.getBoundingClientRect() : null);
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    const id = setInterval(update, 500);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      clearInterval(id);
    };
  }, [stepIndex, enabled]);

  if (!enabled) return null;

  // Skip step if its element doesn't exist (e.g. no Manage button for guests).
  const step = STEPS[stepIndex];
  if (!step) return null;
  if (!rect) {
    // try next step automatically
    if (stepIndex < STEPS.length - 1) {
      // microtask
      setTimeout(() => setStepIndex((i) => i + 1), 0);
      return null;
    }
    return null;
  }

  const finish = () => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
    onDismiss();
  };

  const next = () => {
    if (stepIndex >= STEPS.length - 1) finish();
    else setStepIndex((i) => i + 1);
  };

  // Compute tooltip position
  const padding = 8;
  const tooltipWidth = 320;
  let tipLeft: number;
  let tipTop: number;

  if (step.align === 'top') {
    tipLeft = Math.max(16, rect.left + rect.width / 2 - tooltipWidth / 2);
    tipTop = rect.top - 12 - 180;
  } else if (step.align === 'right') {
    tipLeft = rect.right + padding + 12;
    tipTop = rect.top;
  } else {
    // left -> tooltip on the right of the element
    tipLeft = rect.right + 12;
    tipTop = rect.top;
  }

  // Clamp to viewport
  tipLeft = Math.min(Math.max(16, tipLeft), window.innerWidth - tooltipWidth - 16);
  tipTop = Math.min(Math.max(16, tipTop), window.innerHeight - 220);

  return (
    <div className="tour-overlay" role="dialog" aria-modal="true">
      {/* Spotlight: 4 dark rectangles around the highlighted element */}
      <div className="tour-mask" style={{ height: rect.top + 'px', top: 0, left: 0, right: 0 }} />
      <div className="tour-mask" style={{ top: rect.bottom + 'px', bottom: 0, left: 0, right: 0 }} />
      <div className="tour-mask" style={{ top: rect.top + 'px', height: rect.height + 'px', left: 0, width: rect.left + 'px' }} />
      <div className="tour-mask" style={{ top: rect.top + 'px', height: rect.height + 'px', left: rect.right + 'px', right: 0 }} />

      <div
        className="tour-highlight"
        style={{
          top: rect.top - padding,
          left: rect.left - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
        }}
      />

      <div className="tour-tooltip" style={{ top: tipTop, left: tipLeft, width: tooltipWidth }}>
        <p className="eyebrow">
          Tour · {stepIndex + 1} of {STEPS.length}
        </p>
        <h3>{step.title}</h3>
        <p className="tour-tooltip__body">{step.body}</p>
        <div className="tour-tooltip__footer">
          <button type="button" className="link-btn" onClick={finish}>
            Skip tour
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {stepIndex > 0 && (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setStepIndex((i) => i - 1)}
              >
                Back
              </button>
            )}
            <button type="button" className="btn btn--primary" onClick={next}>
              {stepIndex === STEPS.length - 1 ? 'Got it' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const isTourCompleted = (): boolean => {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return true; }
};

export const resetTour = () => {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
};
