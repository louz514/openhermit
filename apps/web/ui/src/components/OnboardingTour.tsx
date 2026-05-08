import { useEffect, useState } from 'react';
import { BrandMark } from './Icon';

const STORAGE_KEY = 'oh:tour:completed:v2';

interface Step {
  /** CSS selector to spotlight. Omit for a centered modal step (no spotlight). */
  selector?: string;
  title: string;
  body: string;
  align?: 'left' | 'right' | 'top' | 'bottom';
  /** Render the brand mark at the top of the tooltip (intro/outro flavor). */
  hero?: boolean;
}

const STEPS: Step[] = [
  {
    title: 'Welcome to OpenHermit',
    body:
      "This is your agent's home. Conversations live forever, the agent remembers what you tell it, and it can use tools, skills, and apps you connect. Take 30 seconds for a quick tour?",
    hero: true,
  },
  {
    selector: '.sidebar__list',
    title: 'Sessions live here',
    body:
      'Every conversation is saved as its own session. Click "New Session" to start a fresh thread, or click a past one to pick up where you left off.',
    align: 'right',
  },
  {
    selector: '[data-tour="cmdk"]',
    title: 'Jump anywhere with ⌘K',
    body:
      'Open the command palette to switch sessions, jump to a Manage tab, or run quick actions — without lifting your hands off the keyboard.',
    align: 'right',
  },
  {
    selector: '[data-tour="examples"]',
    title: 'Try a starter prompt',
    body:
      "Not sure what to ask? Click any of these to drop the prompt into the composer — you can edit before sending.",
    align: 'top',
  },
  {
    selector: '.composer',
    title: 'Talk to your agent',
    body:
      "Type anything. The agent can read files, run code, browse the web, and call any tool you've enabled.",
    align: 'top',
  },
  {
    selector: '[data-tour="manage"]',
    title: 'Configure everything from here',
    body:
      'As an owner, this opens the Manage panel: secrets, skills, MCP servers, schedules, channels, and policies — all in one place.',
    align: 'right',
  },
  {
    title: "You're set",
    body:
      "You can replay this tour anytime from the Help button in the sidebar. Have fun — and welcome to OpenHermit.",
    hero: true,
  },
];

interface Props {
  enabled: boolean;
  onDismiss: () => void;
}

export function OnboardingTour({ enabled, onDismiss }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Reset to step 0 each time the tour is re-enabled.
  useEffect(() => {
    if (enabled) { setStepIndex(0); setRect(null); }
  }, [enabled]);

  // Clear stale rect whenever the step changes so the spotlight branch
  // doesn't render with the previous step's geometry while the new one
  // is being measured.
  useEffect(() => {
    setRect(null);
  }, [stepIndex]);

  useEffect(() => {
    if (!enabled) return;
    const update = () => {
      const step = STEPS[stepIndex];
      if (!step || !step.selector) { setRect(null); return; }
      const el = document.querySelector(step.selector) as HTMLElement | null;
      setRect(el ? el.getBoundingClientRect() : null);
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    const id = window.setInterval(update, 500);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      window.clearInterval(id);
    };
  }, [stepIndex, enabled]);

  // Keyboard: Esc to dismiss, arrows to navigate.
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); finish(); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, stepIndex]);

  if (!enabled) return null;

  const step = STEPS[stepIndex];
  if (!step) return null;

  const finish = () => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
    onDismiss();
  };

  const next = () => {
    // Skip steps whose target element doesn't exist (e.g. Manage button
    // for guests, or examples grid once the user has sent a message).
    let i = stepIndex + 1;
    while (i < STEPS.length) {
      const s = STEPS[i];
      if (!s) break;
      if (!s.selector) break;
      if (document.querySelector(s.selector)) break;
      i += 1;
    }
    if (i >= STEPS.length) finish();
    else setStepIndex(i);
  };

  const back = () => {
    if (stepIndex === 0) return;
    let i = stepIndex - 1;
    while (i >= 0) {
      const s = STEPS[i];
      if (!s) break;
      if (!s.selector) break;
      if (document.querySelector(s.selector)) break;
      i -= 1;
    }
    setStepIndex(Math.max(0, i));
  };

  // If the current step targets a missing element, jump forward.
  // Use a live DOM query so we don't mistakenly skip a step that simply
  // hasn't been measured yet (rect is null on the very first render of
  // a step until the useEffect runs).
  if (step.selector && !document.querySelector(step.selector)) {
    setTimeout(next, 0);
    return null;
  }

  // Centered modal step (no spotlight).
  if (!step.selector) {
    return (
      <div className="tour-overlay" role="dialog" aria-modal="true" aria-label={step.title}>
        <div className="tour-mask tour-mask--full" onClick={finish} />
        <div className="tour-tooltip tour-tooltip--centered">
          {step.hero && (
            <div className="tour-tooltip__hero" aria-hidden>
              <BrandMark size={36} />
            </div>
          )}
          <p className="eyebrow">Tour · {stepIndex + 1} of {STEPS.length}</p>
          <h3>{step.title}</h3>
          <p className="tour-tooltip__body">{step.body}</p>
          <div className="tour-tooltip__footer">
            <button type="button" className="link-btn" onClick={finish}>
              {stepIndex === 0 ? 'Skip tour' : 'Close'}
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              {stepIndex > 0 && (
                <button type="button" className="btn btn--ghost" onClick={back}>Back</button>
              )}
              <button type="button" className="btn btn--primary" onClick={next}>
                {stepIndex === 0 ? "Show me around" : stepIndex === STEPS.length - 1 ? 'Got it' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Spotlight step.
  if (!rect) return null;
  const padding = 8;
  const tooltipWidth = 320;
  const tooltipHeight = 200;
  let tipLeft: number;
  let tipTop: number;

  if (step.align === 'top') {
    tipLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
    tipTop = rect.top - 12 - tooltipHeight;
  } else if (step.align === 'bottom') {
    tipLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
    tipTop = rect.bottom + 12;
  } else if (step.align === 'right') {
    tipLeft = rect.right + 12;
    tipTop = rect.top;
  } else {
    tipLeft = rect.left - 12 - tooltipWidth;
    tipTop = rect.top;
  }

  tipLeft = Math.min(Math.max(16, tipLeft), window.innerWidth - tooltipWidth - 16);
  tipTop = Math.min(Math.max(16, tipTop), window.innerHeight - tooltipHeight - 16);

  return (
    <div className="tour-overlay" role="dialog" aria-modal="true" aria-label={step.title}>
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
        <p className="eyebrow">Tour · {stepIndex + 1} of {STEPS.length}</p>
        <h3>{step.title}</h3>
        <p className="tour-tooltip__body">{step.body}</p>
        <div className="tour-tooltip__footer">
          <button type="button" className="link-btn" onClick={finish}>Skip tour</button>
          <div style={{ display: 'flex', gap: 8 }}>
            {stepIndex > 0 && (
              <button type="button" className="btn btn--ghost" onClick={back}>Back</button>
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

