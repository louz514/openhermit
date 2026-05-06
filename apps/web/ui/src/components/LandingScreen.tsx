import { ThemeToggle } from './ThemeToggle';

interface Props {
  onGetStarted: () => void;
}

const FEATURES = [
  {
    icon: '🚪',
    title: 'Gateway control plane',
    body: 'Single Hono server. Agents start, attach, detach without orchestration. Admin UI baked in.',
  },
  {
    icon: '🐘',
    title: 'Postgres-backed state',
    body: 'Sessions, memories, instructions, skills, MCP, schedules, secrets — durable behind Drizzle.',
  },
  {
    icon: '🐳',
    title: 'Sandboxed execution',
    body: 'Per-agent sandbox: self-hosted Docker, E2B, or Daytona. Same exec interface across backends.',
  },
  {
    icon: '💬',
    title: 'Channels included',
    body: 'Telegram, Discord, Slack adapters, plus CLI and Web UI. Enable, disable, reconfigure at runtime.',
  },
  {
    icon: '🛠',
    title: 'Skills & MCP',
    body: 'Install centrally, enable per-agent or fleet-wide, audit from one place.',
  },
  {
    icon: '👥',
    title: 'Multi-user with roles',
    body: 'Owner / user / guest. Identity reconciliation across CLI, web, and channels.',
  },
];

const COMPARISON = [
  { area: 'State', file: 'Markdown / JSONL on disk', hermit: 'PostgreSQL, scoped by agent_id' },
  { area: 'Secrets', file: 'Dotfiles', hermit: 'AES-256-GCM encrypted at rest' },
  { area: 'Fleet ops', file: 'SSH-and-pray', hermit: '`hermit … --all`' },
  { area: 'Workspace', file: 'Local filesystem', hermit: 'Per-agent sandbox (Docker / E2B / Daytona)' },
  { area: 'Channels', file: 'Manual integration', hermit: 'Built-in adapters with hot reload' },
  { area: 'Multi-tenant', file: 'One human, one machine', hermit: 'Users, roles, identity merge' },
];

export function LandingScreen({ onGetStarted }: Props) {
  return (
    <div className="landing">
      <header className="landing__nav">
        <div className="landing__brand">
          <span className="landing__logo">🜲</span>
          <span className="landing__brand-name">OpenHermit</span>
        </div>
        <nav className="landing__nav-links">
          <a href="#features">Features</a>
          <a href="#why">Why</a>
          <a href="#quickstart">Quick start</a>
          <a
            href="https://github.com/louz514/openhermit"
            target="_blank"
            rel="noreferrer noopener"
          >
            GitHub
          </a>
          <ThemeToggle />
          <button className="btn btn--primary btn--sm" type="button" onClick={onGetStarted}>
            Sign in
          </button>
        </nav>
      </header>

      <section className="landing__hero">
        <p className="landing__eyebrow">Open source · MIT</p>
        <h1 className="landing__title">
          Agents, but <span className="landing__title-accent">operable</span>.
        </h1>
        <p className="landing__lede">
          OpenHermit is a control plane for running fleets of AI agents as production
          services. Durable state, sandboxed execution, multi-user roles, and the channels
          you already use — managed from a single gateway.
        </p>
        <div className="landing__cta">
          <button className="btn btn--primary btn--lg" type="button" onClick={onGetStarted}>
            Get started
          </button>
          <a
            className="btn btn--ghost btn--lg"
            href="https://github.com/louz514/openhermit"
            target="_blank"
            rel="noreferrer noopener"
          >
            Star on GitHub
          </a>
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
              <div className="landing__feature-icon">{f.icon}</div>
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
            Once internal state is centralized, fleet operations become trivial. Roll out a
            skill, push a rule, rotate a secret — fan-out is built in.
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
        <h2>Ready to run agents that don't fall apart at scale?</h2>
        <p className="landing__section-lede">
          Set up takes a few minutes. Postgres, an admin token, and a JWT secret are all
          you need.
        </p>
        <div className="landing__cta">
          <button className="btn btn--primary btn--lg" type="button" onClick={onGetStarted}>
            Get started
          </button>
          <a
            className="btn btn--ghost btn--lg"
            href="https://github.com/louz514/openhermit"
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
          <a href="https://github.com/louz514/openhermit" target="_blank" rel="noreferrer noopener">
            GitHub
          </a>
          <a href="https://github.com/louz514/openhermit/tree/main/docs" target="_blank" rel="noreferrer noopener">
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
