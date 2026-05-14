import { useEffect, useState } from 'react';
import type { Tab } from '../router';

const STORAGE_KEY = 'openhermit:walkthrough:dismissed:v1';

type Step = {
  tab: Tab;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    tab: 'fleet',
    title: 'Welcome to OpenHermit',
    body:
      "This is the admin control plane. Each tab is a different operational concern. Use Next/Back to walk through what each one does — we'll jump to the matching tab as you go.",
  },
  {
    tab: 'fleet',
    title: 'Agents — your fleet',
    body:
      'An agent is the smallest deployable unit: identity, instructions, sandbox, channels, schedules, secrets, and skill assignments. Most setups start with a single agent named "main". Use this tab to create agents, edit config, manage per-agent secrets, and start/stop them.',
  },
  {
    tab: 'skills',
    title: 'Skills — reusable capabilities',
    body:
      'Skills are bundles of instructions, files, and tool affordances. Enable a skill on a single agent, or roll it out fleet-wide. The gateway ships with two built-ins (openhermit-usage, skill-creator) and discovers any folder under skills/.',
  },
  {
    tab: 'mcp-servers',
    title: 'MCP — external tool servers',
    body:
      'Register Model Context Protocol servers once at the gateway, then assign them per-agent or fleet-wide. Common picks: GitHub, filesystem, browser automation, internal tools.',
  },
  {
    tab: 'schedules',
    title: 'Schedules — cron + one-shots',
    body:
      'Trigger sessions on a schedule. Cron jobs for daily digests or hourly inbox sweeps; one-shots for follow-ups. Each schedule belongs to an agent and records run history with timeout and concurrency policy.',
  },
  {
    tab: 'channels',
    title: 'Channels — where users reach the agent',
    body:
      'Adapters for Telegram, Discord, Slack, plus the built-in CLI and Web channels. Enabling a channel attaches it to an agent and starts the adapter. Channel-specific secrets (bot tokens, signing secrets) live in the channel config.',
  },
  {
    tab: 'sandboxes',
    title: 'Sandboxes — where tools execute',
    body:
      'Per-agent execution environments. Three backends: docker (local containers, default for self-hosting), e2b (cloud), and daytona (cloud). Sandbox presets define resource shape — image, CPU, memory.',
  },
  {
    tab: 'users',
    title: 'Users — end-users of your agents',
    body:
      'Each user is a single record with identities reconciled across channels (Telegram ID, web session, CLI device). Roles: owner, user, guest. Use this tab to inspect identity links, see which agents a user can access, and revoke access.',
  },
  {
    tab: 'stats',
    title: 'Stats — health at a glance',
    body:
      'Agents online, sessions in flight, recent error rate, queue depth, sandbox utilization. The first place to look when something feels off.',
  },
  {
    tab: 'logs',
    title: 'Logs — live + filterable',
    body:
      'Structured gateway logs with filtering. Equivalent to `hermit logs -f` but in the browser. Use this to trace a specific request or watch a deploy land.',
  },
  {
    tab: 'config',
    title: 'Config — what the gateway loaded',
    body:
      'Read-only view of resolved gateway configuration plus an indicator of where each value came from (.env, defaults, etc). Use this to confirm a deploy picked up the env vars you expected.',
  },
  {
    tab: 'fleet',
    title: "You're set",
    body:
      "That's the tour. Minimum viable setup: create an agent → set its model provider secret → start the web app at /admin/ on the gateway host (or 127.0.0.1:4310 in dev) → chat. You can re-open this tour any time from the help button in the top bar.",
  },
];

export function Walkthrough({
  open,
  onClose,
  onTabChange,
}: {
  open: boolean;
  onClose: (opts?: { dontShowAgain?: boolean }) => void;
  onTabChange: (tab: Tab) => void;
}) {
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    if (open) setStepIdx(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const target = STEPS[stepIdx]?.tab;
    if (target) onTabChange(target);
  }, [open, stepIdx, onTabChange]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setStepIdx((i) => Math.min(STEPS.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setStepIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;

  return (
    <div className="walkthrough__backdrop" role="dialog" aria-modal="true" aria-label="OpenHermit walkthrough">
      <div className="walkthrough__card">
        <div className="walkthrough__progress">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`walkthrough__dot${i === stepIdx ? ' walkthrough__dot--active' : ''}${i < stepIdx ? ' walkthrough__dot--done' : ''}`}
            />
          ))}
        </div>
        <div className="walkthrough__eyebrow">
          Step {stepIdx + 1} of {STEPS.length}
        </div>
        <h2 className="walkthrough__title">{step.title}</h2>
        <p className="walkthrough__body">{step.body}</p>

        <div className="walkthrough__actions">
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => onClose({ dontShowAgain: true })}
          >
            Don't show again
          </button>
          <div className="walkthrough__actions-right">
            <button
              className="btn btn--sm"
              onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
              disabled={stepIdx === 0}
            >
              Back
            </button>
            {isLast ? (
              <button
                className="btn btn--primary btn--sm"
                onClick={() => onClose({ dontShowAgain: true })}
              >
                Finish
              </button>
            ) : (
              <button
                className="btn btn--primary btn--sm"
                onClick={() => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1))}
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const walkthroughStorage = {
  isDismissed: (): boolean => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  },
  setDismissed: (dismissed: boolean): void => {
    try {
      if (dismissed) window.localStorage.setItem(STORAGE_KEY, '1');
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore — non-fatal
    }
  },
};
