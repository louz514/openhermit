import { ThemeToggle } from './ThemeToggle';
import { Icon, type IconName } from './Icon';

interface Props {
  onGetStarted: () => void;
  resumeTarget?: 'setup' | 'pick-agent' | 'chat';
}

const REPO_URL = 'https://github.com/louz514/openhermit';

const HERO_STATS = [
  { value: '1', label: 'server, every agent' },
  { value: '6', label: 'apps out of the box' },
  { value: 'MIT', label: 'open source' },
];

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

export function LandingScreen({ onGetStarted, resumeTarget = 'setup' }: Props) {
  const ctaPrimary =
    resumeTarget === 'chat'
      ? 'Resume chat'
      : resumeTarget === 'pick-agent'
      ? 'Pick agent'
      : 'Get started';
  const ctaNav =
    resumeTarget === 'setup' ? 'Sign in' : 'Open app';

  return (
    <div className="landing">
      <header className="landing__nav">
        <div className="landing__brand">
          <img src="/logo.png" alt="OpenHermit logo" className="landing__logo-img" width={32} height={32} />
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
      </header>

      <section className="landing__hero">
        <p className="landing__eyebrow">Open source · MIT</p>
        <h1 className="landing__title">
          Agents, but <span className="landing__title-accent">operable</span>.
        </h1>
        <p className="landing__lede">
          OpenHermit is a hub for running AI assistants as real services. Memory that
          lasts, isolated workspaces, team roles, and the apps you already use — all
          managed from one place.
        </p>
        <div className="landing__cta">
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
        </div>
        <div className="landing__stats">
          {HERO_STATS.map((s) => (
            <div className="landing__stat" key={s.label}>
              <span className="landing__stat-value">{s.value}</span>
              <span className="landing__stat-label">{s.label}</span>
            </div>
          ))}
        </div>
        <pre className="landing__code">
          <code>
            <span className="landing__code-comment"># install</span>
            {'\n'}npm install -g openhermit
            {'\n'}
            {'\n'}<span className="landing__code-comment"># start</span>
            {'\n'}hermit setup
            {'\n'}hermit gateway start
            {'\n'}hermit agents create main && hermit agents start main
            {'\n'}hermit chat --agent main
          </code>
        </pre>
      </section>

      <section id="why" className="landing__section landing__why">
        <div className="landing__section-head">
          <p className="landing__eyebrow">Why OpenHermit</p>
          <h2>State that scales past one human, one machine.</h2>
          <p className="landing__section-lede">
            Most CLI agents keep state in files: memories as markdown, sessions as JSONL,
            secrets as dotfiles. Perfect for one developer. Falls apart the moment you run
            an internal platform, a SaaS where every customer gets their own agent, or a
            swarm of specialized roles. OpenHermit makes one core design choice:{' '}
            <strong>separate internal state from external state.</strong>
          </p>
        </div>
        <div className="landing__compare">
          <div className="landing__compare-row landing__compare-head">
            <div></div>
            <div>File-based agents</div>
            <div className="landing__compare-mine">OpenHermit</div>
          </div>
          {COMPARISON.map((row) => (
            <div className="landing__compare-row" key={row.area}>
              <div className="landing__compare-area">{row.area}</div>
              <div className="landing__compare-old">{row.file}</div>
              <div className="landing__compare-new">{row.hermit}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="landing__section">
        <div className="landing__section-head">
          <p className="landing__eyebrow">Features</p>
          <h2>Everything an agent platform needs, none of the bespoke glue.</h2>
        </div>
        <div className="landing__features">
          {FEATURES.map((f) => (
            <div className="landing__feature" key={f.title}>
              <div className="landing__feature-icon"><Icon name={f.icon} size={22} /></div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="quickstart" className="landing__section landing__fleet">
        <div className="landing__section-head">
          <p className="landing__eyebrow">Fleet operations</p>
          <h2>Roll changes across every agent with one command.</h2>
          <p className="landing__section-lede">
            Once everything lives in one place, rolling out an ability, pushing a rule, or
            rotating a secret is a single command — not a tour of every machine.
          </p>
        </div>
        <pre className="landing__code landing__code--wide">
          <code>
            <span className="landing__code-comment"># roll a skill out to every agent</span>
            {'\n'}hermit skills enable standup-digest --all
            {'\n'}
            {'\n'}<span className="landing__code-comment"># add an MCP server fleet-wide</span>
            {'\n'}hermit mcp enable mcp_github --all
            {'\n'}
            {'\n'}<span className="landing__code-comment"># push a behavior rule to every agent</span>
            {'\n'}hermit instructions append rules "Never share PII." --all
            {'\n'}
            {'\n'}<span className="landing__code-comment"># rotate a secret on a single agent</span>
            {'\n'}hermit config secrets set OPENROUTER_API_KEY sk-... --agent main
          </code>
        </pre>
      </section>

      <section className="landing__section landing__cta-section">
        <h2>Ready to run assistants that don't fall apart at scale?</h2>
        <p className="landing__section-lede">
          Setup takes a few minutes. A database, an admin token, and a signing secret —
          that's it.
        </p>
        <div className="landing__cta">
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
        </div>
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
