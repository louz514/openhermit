import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useScroll,
  useTransform,
  useSpring,
  useInView,
  useMotionValue,
  useReducedMotion,
  type MotionValue,
} from 'motion/react';
import { ThemeToggle, useTheme } from './ThemeToggle';
import { Icon, type IconName } from './Icon';

// three.js + bloom is ~170 kB gzip — lazy-load so it only ships when
// the landing page is actually rendered, and so it doesn't block first
// paint of the hero text.
const ParticlesBackground = lazy(() =>
  import('./ParticlesBackground').then((m) => ({ default: m.ParticlesBackground })),
);

interface Props {
  onGetStarted: () => void;
  resumeTarget?: 'setup' | 'pick-agent' | 'chat';
}

const REPO_URL = 'https://github.com/louz514/openhermit';

// Shared easings — Principle 1 (Easing). Keep all entrances feeling
// like one product instead of a parade of different curves.
const EASE_OUT_SOFT = [0.16, 1, 0.3, 1] as const;
const EASE_INOUT = [0.65, 0, 0.35, 1] as const;

const HERO_STATS = [
  { value: 1, suffix: '', label: 'server, every agent' },
  { value: 6, suffix: '', label: 'apps out of the box' },
  { value: 12, suffix: '', label: 'principles of motion' },
];

/* Hero role-chip pool. Three chips cycle through these every few
   seconds (Principle 4 — Transformation — same identity, new role)
   so the hero feels alive without becoming distracting. */
const ROLE_POOL = [
  'Researcher',
  'Trader',
  'Copywriter',
  'Coder',
  'Analyst',
  'Curator',
  'Concierge',
  'Scout',
  'Editor',
  'Sentinel',
] as const;

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'door',
    title: 'One server, every agent',
    body: 'A single hub starts, attaches, and supervises agents \u2014 no orchestration to wire up. The admin UI is built in.',
  },
  {
    icon: 'database',
    title: 'Memory that lasts',
    body: 'Conversations, memories, instructions, abilities, integrations, tasks, and secrets all live in Postgres \u2014 durable, queryable, backup-able.',
  },
  {
    icon: 'box',
    title: 'Safe-by-default workspace',
    body: 'Each agent runs in its own isolated workspace (Docker, E2B, or Daytona). Same interface no matter which one you pick.',
  },
  {
    icon: 'message-square',
    title: 'Apps you already use',
    body: 'Telegram, Discord, Slack, plus CLI and Web. Turn them on and off at runtime without restarts.',
  },
  {
    icon: 'wand',
    title: 'Abilities & integrations',
    body: 'Install once, then enable per agent or across the whole fleet. Audit everything from one place.',
  },
  {
    icon: 'users',
    title: 'Built for teams',
    body: 'Owner, user, and guest roles. People stay themselves whether they\'re in CLI, web, or a chat app.',
  },
];

const COMPARISON = [
  { area: 'State', file: 'Markdown / JSONL on disk', hermit: 'PostgreSQL, scoped by agent' },
  { area: 'Secrets', file: 'Dotfiles', hermit: 'AES-256-GCM encrypted at rest' },
  { area: 'Fleet ops', file: 'SSH-and-pray', hermit: '`hermit … --all`' },
  { area: 'Workspace', file: 'Local filesystem', hermit: 'Per-agent sandbox (Docker / E2B / Daytona)' },
  { area: 'Channels', file: 'Manual integration', hermit: 'Built-in adapters with hot reload' },
  { area: 'Multi-tenant', file: 'One human, one machine', hermit: 'Users, roles, identity merge' },
];

const CODE_LINES = [
  { c: '# install', muted: true },
  { c: 'npm install -g openhermit' },
  { c: '' },
  { c: '# start', muted: true },
  { c: 'hermit setup' },
  { c: 'hermit gateway start' },
  { c: 'hermit agents create main && hermit agents start main' },
  { c: 'hermit chat --agent main' },
];

const FLEET_CODE = [
  { c: '# roll a skill out to every agent', muted: true },
  { c: 'hermit skills enable standup-digest --all' },
  { c: '' },
  { c: '# add an MCP server fleet-wide', muted: true },
  { c: 'hermit mcp enable mcp_github --all' },
  { c: '' },
  { c: '# push a behavior rule to every agent', muted: true },
  { c: 'hermit instructions append rules "Never share PII." --all' },
  { c: '' },
  { c: '# rotate a secret on a single agent', muted: true },
  { c: 'hermit config secrets set OPENROUTER_API_KEY sk-... --agent main' },
];

/* ─────────────────────────────────────────────────────────────────────
   Animated number counter — Principle 5 (Value Change). Counts from 0
   up to the target when scrolled into view; respects reduced motion.
   ───────────────────────────────────────────────────────────────────── */
function AnimatedCounter({ to, duration = 1.2 }: { to: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? to : 0);
  useEffect(() => {
    if (!inView || reduce) return;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min((t - start) / (duration * 1000), 1);
      // ease-out cubic — Principle 1 (Easing)
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(to * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration, reduce]);
  return <span ref={ref}>{n}</span>;
}

/* Parallax helper — Principle 10. Maps a scroll progress to a Y offset
   at the given depth (0 = static, 1 = full range). */
function useParallaxY(scrollYProgress: MotionValue<number>, depth: number, range = 120) {
  return useTransform(scrollYProgress, [0, 1], [range * depth, -range * depth]);
}

/* Animated code block — Principle 6 (Masking) line-by-line reveal,
   Principle 2 (Offset & Delay) stagger, Principle 3 (Parenting) caret
   anchored to the block as it pulses. */
function AnimatedCode({
  lines,
  className,
}: {
  lines: { c: string; muted?: boolean }[];
  className?: string;
}) {
  const ref = useRef<HTMLPreElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  const reduce = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const plainText = lines.map((l) => l.c).join('\n');
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked — silently no-op */
    }
  }
  return (
    <div className={`landing__code-wrap ${className ?? ''}`}>
      <pre ref={ref} className="landing__code">
        <code>
          {lines.map((line, i) => (
            <motion.span
              key={i}
              className="landing__code-line"
              initial={reduce ? false : { clipPath: 'inset(0 100% 0 0)' }}
              animate={inView ? { clipPath: 'inset(0 0% 0 0)' } : undefined}
              transition={{ duration: 0.55, delay: 0.08 * i, ease: EASE_OUT_SOFT }}
            >
              <span className={line.muted ? 'landing__code-comment' : ''}>{line.c || '\u00a0'}</span>
              {'\n'}
            </motion.span>
          ))}
          <motion.span
            className="landing__code-caret"
            initial={reduce ? false : { opacity: 0 }}
            animate={inView ? { opacity: [0, 1, 0] } : undefined}
            transition={{ duration: 1, repeat: Infinity, ease: EASE_INOUT, delay: 0.08 * lines.length }}
            aria-hidden
          >
            ▌
          </motion.span>
        </code>
      </pre>
      <button
        type="button"
        className={`landing__code-copy${copied ? ' is-copied' : ''}`}
        onClick={onCopy}
        aria-label={copied ? 'Copied' : 'Copy to clipboard'}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={copied ? 'ok' : 'copy'}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: EASE_OUT_SOFT }}
          >
            {copied ? 'Copied' : 'Copy'}
          </motion.span>
        </AnimatePresence>
      </button>
    </div>
  );
}

/* Dolly-style tilting stage — Principle 11 (Dimensionality) +
   Principle 12 (Dolly). Tilts forward + scales as it enters the
   viewport, settles flat at center, recedes on exit. */
function DollyTilt({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'center center', 'end start'],
  });
  const reduce = useReducedMotion();
  const rotateX = useSpring(
    useTransform(scrollYProgress, [0, 0.5, 1], reduce ? [0, 0, 0] : [18, 0, -10]),
    { stiffness: 120, damping: 22 },
  );
  const scale = useSpring(
    useTransform(scrollYProgress, [0, 0.5, 1], reduce ? [1, 1, 1] : [0.9, 1, 0.96]),
    { stiffness: 120, damping: 22 },
  );
  return (
    <div ref={ref} className="landing__dolly">
      <motion.div className="landing__dolly-stage" style={{ rotateX, scale, transformPerspective: 1200 }}>
        {children}
      </motion.div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   AuroraBackground — the animated hero backdrop. Combines:
     · Principle 4  (Transformation) — each blob continuously morphs
       position & scale, never sitting still.
     · Principle 2  (Offset & Delay)  — every blob runs on its own
       offset clock so the mesh never "pulses" in unison.
     · Principle 11 (Dimensionality)  — varying blur + scale assigns
       each blob to a different depth plane.
     · Principle 1  (Easing)          — smooth in-out curves keep the
       motion organic, never mechanical.
   Honors `prefers-reduced-motion` by rendering a static composition.
   ───────────────────────────────────────────────────────────────────── */
const AURORA_BLOBS = [
  // { hue: css color expr, base position, size, depth (0..1) }
  { color: 'color-mix(in srgb, var(--accent) 55%, transparent)',         x: '18%', y: '24%', size: 520, depth: 0.9, dur: 14 },
  { color: 'color-mix(in srgb, var(--accent-strong) 45%, transparent)', x: '78%', y: '20%', size: 460, depth: 0.7, dur: 17 },
  { color: 'color-mix(in srgb, var(--accent-soft) 90%, transparent)',   x: '50%', y: '78%', size: 620, depth: 1.0, dur: 19 },
  { color: 'color-mix(in srgb, var(--accent) 32%, transparent)',         x: '12%', y: '78%', size: 380, depth: 0.5, dur: 13 },
  { color: 'color-mix(in srgb, var(--accent-strong) 28%, transparent)', x: '88%', y: '62%', size: 340, depth: 0.4, dur: 21 },
];

function AuroraBackground() {
  const reduce = useReducedMotion();
  return (
    <>
      {AURORA_BLOBS.map((b, i) => (
        <motion.div
          key={i}
          className="landing__aurora-blob"
          style={{
            left: b.x,
            top: b.y,
            width: b.size,
            height: b.size,
            background: `radial-gradient(closest-side, ${b.color} 0%, transparent 70%)`,
            // Depth → blur. Closer blobs are sharper, farther blobs softer.
            filter: `blur(${40 + (1 - b.depth) * 60}px)`,
            opacity: 0.55 + b.depth * 0.25,
          }}
          animate={
            reduce
              ? undefined
              : {
                  // Transformation — each blob drifts on its own little
                  // looping path. Offsets are scaled by depth so deeper
                  // blobs travel further (parallax-ish illusion).
                  x: [0, 60 * b.depth, -40 * b.depth, 0],
                  y: [0, -45 * b.depth, 30 * b.depth, 0],
                  scale: [1, 1.08, 0.96, 1],
                }
          }
          transition={{
            duration: b.dur,
            // Offset & Delay — every blob starts at a different phase.
            delay: i * 0.6,
            repeat: Infinity,
            ease: [0.42, 0, 0.58, 1], // ease-in-out
          }}
        />
      ))}
      {/* Soft rotating sheen — Transformation at the macro scale. */}
      <motion.div
        className="landing__aurora-sheen"
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 80, repeat: Infinity, ease: 'linear' }}
        aria-hidden
      />
    </>
  );
}

/* Hero role chips that cycle through ROLE_POOL. Three chips, each on
   its own offset clock (Principle 2). On reduced-motion, picks one
   fixed triple. */
function CyclingChips({ reduce }: { reduce: boolean }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 2600);
    return () => window.clearInterval(id);
  }, [reduce]);
  // Three slots that step through ROLE_POOL at staggered offsets.
  const slots = [0, 1, 2].map((slot) => {
    const idx = (tick + slot * 3) % ROLE_POOL.length;
    return ROLE_POOL[idx]!;
  });
  return (
    <div className="landing__hero-chips" aria-hidden>
      {slots.map((label, slot) => (
        <span key={slot} className="landing__hero-chip">
          {/* No mode="wait" — let exit and enter overlap so the chip
              never reads as blank between cycles. */}
          <AnimatePresence initial={false}>
            <motion.span
              key={label}
              className="landing__hero-chip-label"
              initial={reduce ? false : { opacity: 0, y: 8, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={reduce ? undefined : { opacity: 0, y: -8, filter: 'blur(4px)' }}
              transition={{ duration: 0.45, ease: EASE_OUT_SOFT, delay: slot * 0.06 }}
            >
              {label}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </div>
  );
}

/* Comparison row — Principle 9 (Obscuration). Non-hovered rows dim +
   blur so the focused row pops. Stagger handled by parent index. */
function CompareRow({
  row,
  index,
  hovered,
  onHover,
}: {
  row: (typeof COMPARISON)[number];
  index: number;
  hovered: number | null;
  onHover: (i: number | null) => void;
}) {
  const dimmed = hovered !== null && hovered !== index;
  return (
    <motion.div
      className="landing__compare-row"
      onMouseEnter={() => onHover(index)}
      onMouseLeave={() => onHover(null)}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.55, delay: 0.06 * index, ease: EASE_OUT_SOFT }}
      animate={{ filter: dimmed ? 'blur(1.5px)' : 'blur(0px)', opacity: dimmed ? 0.45 : 1 }}
    >
      <div className="landing__compare-area">{row.area}</div>
      <div className="landing__compare-old">{row.file}</div>
      <div className="landing__compare-new">{row.hermit}</div>
    </motion.div>
  );
}

export function LandingScreen({ onGetStarted, resumeTarget = 'setup' }: Props) {
  const ctaPrimary =
    resumeTarget === 'chat'
      ? 'Resume chat'
      : resumeTarget === 'pick-agent'
      ? 'Pick agent'
      : 'Get started';
  const ctaNav =
    resumeTarget === 'setup' ? 'Sign in' : 'Open app';

  const reduce = useReducedMotion();

  // Theme drives the constellation's blending mode, color palette, and
  // bloom path — read it here so we can remount ParticlesBackground on
  // toggle (the WebGL setup needs to rebuild, not mutate, when theme
  // flips).
  const [theme] = useTheme();

  // Drop bloom + halve particle count on touch / narrow / low-memory
  // devices. Detected once on mount — we don't reactively flip mid-
  // session, which would tear down the WebGL context for no reason.
  const [particlesLite] = useState(() => {
    if (typeof window === 'undefined') return true;
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const narrow = window.innerWidth < 900;
    // navigator.deviceMemory is non-standard; treat <=4 GB as low-end.
    const lowMem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory != null
      && ((navigator as Navigator & { deviceMemory?: number }).deviceMemory as number) <= 4;
    return coarse || narrow || lowMem;
  });

  // Hero parallax — Principle 10. Foreground drifts up as scroll
  // progresses; the page-level constellation backdrop handles depth
  // on its own (fixed + cursor parallax).
  const heroRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroContentY = useTransform(heroProgress, [0, 1], [0, reduce ? 0 : -60]);
  const heroOpacity = useTransform(heroProgress, [0, 0.8], [1, reduce ? 1 : 0.2]);

  // Compare-row obscuration state.
  const [hovered, setHovered] = useState<number | null>(null);

  // Feature parallax depth layers.
  const featuresRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress: featProgress } = useScroll({
    target: featuresRef,
    offset: ['start end', 'end start'],
  });
  const featDepthA = useParallaxY(featProgress, 0.3);
  const featDepthB = useParallaxY(featProgress, 0.6);
  const featDepthC = useParallaxY(featProgress, 0.15);

  // CTA overlay sweep — Principle 7. Sweeps in behind the buttons on
  // first view, lifting them above an animated colored band.
  const ctaRef = useRef<HTMLElement | null>(null);
  const ctaInView = useInView(ctaRef, { once: true, amount: 0.5 });

  // Nav backdrop fades in once we scroll past the hero crest.
  const navOpacity = useMotionValue(0);
  useEffect(() => {
    const onScroll = () => {
      navOpacity.set(Math.min(window.scrollY / 80, 1));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [navOpacity]);

  return (
    <div className="landing landing--motion">
      {/* Page-level animated background. Lives behind every section, not just
          the hero, so the constellation appears to flow continuously as the
          user scrolls. position:fixed in CSS. */}
      {!reduce && (
        <div className="landing__bg-fx" aria-hidden>
          <Suspense fallback={null}>
            {/* `key={theme}` forces a clean teardown/rebuild of the WebGL
                scene whenever the user toggles light/dark, so colors
                and blending stay in sync with the page. */}
            <ParticlesBackground key={theme} lite={particlesLite} />
          </Suspense>
        </div>
      )}
      <motion.header
        className="landing__nav landing__nav--sticky"
        style={{ ['--nav-bg-alpha' as never]: navOpacity }}
      >
        <div className="landing__brand">
          <button
            type="button"
            className="landing__logo-btn"
            onClick={() => {
              // Easter egg — Principle 4 (Transformation): clicking the
              // logo sends a burst event to the constellation backdrop
              // which briefly spins up and pulses outward.
              window.dispatchEvent(new CustomEvent('openhermit:scramble'));
            }}
            aria-label="OpenHermit"
          >
            <img src="/logo.png" alt="OpenHermit logo" className="landing__logo-img" width={32} height={32} />
          </button>
          <span className="landing__brand-name">OpenHermit</span>
        </div>
        <nav className="landing__nav-links">
          <a href="#features">Features</a>
          <a href="#why">Why</a>
          <a href="#quickstart">Quick start</a>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
          >
            GitHub
          </a>
          <ThemeToggle />
          <button className="btn btn--primary btn--sm" type="button" onClick={onGetStarted}>
            {ctaNav}
          </button>
        </nav>
      </motion.header>

      {/* HERO — Easing, Cloning (chips fan out), Value Change (counters), Parallax */}
      <section ref={heroRef} className="landing__hero">
        <motion.div className="landing__hero-inner" style={{ y: heroContentY, opacity: heroOpacity }}>
          <motion.p
            className="landing__eyebrow"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT_SOFT }}
          >
            Open source · MIT
          </motion.p>
          <motion.h1
            className="landing__title"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05, ease: EASE_OUT_SOFT }}
          >
            Agents, but{' '}
            <span className="landing__title-accent">
              operable
              <motion.span
                className="landing__title-underline"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, delay: 0.7, ease: EASE_OUT_SOFT }}
                aria-hidden
              />
            </span>
            .
          </motion.h1>
          <motion.p
            className="landing__lede"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: EASE_OUT_SOFT }}
          >
            OpenHermit is a hub for running AI assistants as real services. Memory that
            lasts, isolated workspaces, team roles, and the apps you already use — all
            managed from one place.
          </motion.p>

          {/* Cycling roles — one identity, many jobs. Rotates through
              ROLE_POOL every ~2.6s with a fast crossfade. */}
          <CyclingChips reduce={!!reduce} />

          <motion.div
            className="landing__cta"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45, ease: EASE_OUT_SOFT }}
          >
            <button className="btn btn--primary btn--lg" type="button" onClick={onGetStarted}>
              {ctaPrimary}
            </button>
            <a
              className="btn btn--ghost btn--lg"
              href={REPO_URL}
              target="_blank"
              rel="noreferrer noopener"
            >
              Star on GitHub
            </a>
          </motion.div>
          <div className="landing__stats">
            {HERO_STATS.map((s, i) => (
              <motion.div
                className="landing__stat"
                key={s.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.55 + i * 0.08, ease: EASE_OUT_SOFT }}
              >
                <span className="landing__stat-value">
                  <AnimatedCounter to={s.value} />
                  {s.suffix}
                </span>
                <span className="landing__stat-label">{s.label}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* QUICK INSTALL — Masking + Parenting via animated code reveal */}
      <section className="landing__section landing__install">
        <div className="landing__section-head">
          <p className="landing__eyebrow">Quick start</p>
          <h2>Four commands. You're up.</h2>
        </div>
        <AnimatedCode lines={CODE_LINES} />
      </section>

      {/* WHY — Offset & Delay (stagger) + Obscuration (blur non-hovered) */}
      <section id="why" className="landing__section landing__why">
        <div className="landing__section-head">
          <motion.p
            className="landing__eyebrow"
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.5, ease: EASE_OUT_SOFT }}
          >
            Why OpenHermit
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.6, ease: EASE_OUT_SOFT }}
          >
            State that scales past one human, one machine.
          </motion.h2>
          <motion.p
            className="landing__section-lede"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.6, delay: 0.1, ease: EASE_OUT_SOFT }}
          >
            Most CLI agents keep state in files: memories as markdown, sessions as JSONL,
            secrets as dotfiles. Perfect for one developer. Falls apart the moment you run
            an internal platform, a SaaS where every customer gets their own agent, or a
            swarm of specialized roles. OpenHermit makes one core design choice:{' '}
            <strong>separate internal state from external state.</strong>
          </motion.p>
        </div>
        <div className="landing__compare">
          <div className="landing__compare-row landing__compare-head">
            <div></div>
            <div>File-based agents</div>
            <div className="landing__compare-mine">OpenHermit</div>
          </div>
          {COMPARISON.map((row, i) => (
            <CompareRow
              key={row.area}
              row={row}
              index={i}
              hovered={hovered}
              onHover={setHovered}
            />
          ))}
        </div>
      </section>

      {/* FEATURES — Parallax depth layers + Transformation icon morph on hover */}
      <section ref={featuresRef} id="features" className="landing__section">
        <div className="landing__section-head">
          <motion.p
            className="landing__eyebrow"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            Features
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: EASE_OUT_SOFT }}
          >
            Everything an agent platform needs, none of the bespoke glue.
          </motion.h2>
        </div>
        <div className="landing__features">
          {FEATURES.map((f, i) => {
            const y = i % 3 === 0 ? featDepthA : i % 3 === 1 ? featDepthC : featDepthB;
            return (
              <motion.div
                key={f.title}
                className="landing__feature"
                style={{ y }}
                initial={{ opacity: 0, y: 36 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.6, delay: 0.05 * i, ease: EASE_OUT_SOFT }}
                whileHover={reduce ? undefined : { y: -6, rotate: -0.5, scale: 1.02 }}
              >
                <motion.div
                  className="landing__feature-icon"
                  whileHover={reduce ? undefined : { rotate: 8, scale: 1.15 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 16 }}
                >
                  <Icon name={f.icon} size={22} />
                </motion.div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* FLEET — Dolly + Dimensionality. The terminal tilts in 3D, settles, recedes. */}
      <section id="quickstart" className="landing__section landing__fleet">
        <div className="landing__section-head">
          <motion.p
            className="landing__eyebrow"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            Fleet operations
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: EASE_OUT_SOFT }}
          >
            Roll changes across every agent with one command.
          </motion.h2>
          <motion.p
            className="landing__section-lede"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1, ease: EASE_OUT_SOFT }}
          >
            Once everything lives in one place, rolling out an ability, pushing a rule, or
            rotating a secret is a single command — not a tour of every machine.
          </motion.p>
        </div>
        <DollyTilt>
          <AnimatedCode lines={FLEET_CODE} className="landing__code--wide" />
        </DollyTilt>
      </section>

      {/* CTA — Overlay sweep behind the buttons */}
      <section ref={ctaRef} className="landing__section landing__cta-section">
        <motion.div
          className="landing__cta-sweep"
          initial={{ scaleX: 0, opacity: 0 }}
          animate={ctaInView ? { scaleX: 1, opacity: 1 } : undefined}
          transition={{ duration: 0.9, ease: EASE_OUT_SOFT }}
          aria-hidden
        />
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: EASE_OUT_SOFT }}
        >
          Ready to run assistants that don't fall apart at scale?
        </motion.h2>
        <motion.p
          className="landing__section-lede"
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1, ease: EASE_OUT_SOFT }}
        >
          Setup takes a few minutes. A database, an admin token, and a signing secret —
          that's it.
        </motion.p>
        <motion.div
          className="landing__cta"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2, ease: EASE_OUT_SOFT }}
        >
          <button className="btn btn--primary btn--lg" type="button" onClick={onGetStarted}>
            {ctaPrimary}
          </button>
          <a
            className="btn btn--ghost btn--lg"
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
          >
            View source
          </a>
        </motion.div>
      </section>

      <footer className="landing__footer">
        <span>OpenHermit · MIT licensed</span>
        <span className="landing__footer-links">
          <a href={REPO_URL} target="_blank" rel="noreferrer noopener">
            GitHub
          </a>
          <a href={`${REPO_URL}/tree/main/docs`} target="_blank" rel="noreferrer noopener">
            Docs
          </a>
          <a href="https://www.npmjs.com/package/openhermit" target="_blank" rel="noreferrer noopener">
            npm
          </a>
        </span>
      </footer>
    </div>
  );
}
