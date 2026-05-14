# Getting Started — Self-Hoster's Walkthrough

This is a guided tour for **first-time self-hosters** standing up an OpenHermit
gateway. It walks through every section of the admin UI and explains what each
one is for, when to use it, and what a healthy setup looks like.

If you have not yet installed OpenHermit, see the [README](../README.md#installation)
first. The gateway must be running and reachable at `http://127.0.0.1:4000` (or
whatever host you configured).

---

## 1. Sign in to the admin UI

Open `http://127.0.0.1:4000/admin/`.

You will be prompted for an **admin token**. This is the value of
`GATEWAY_ADMIN_TOKEN` from your `.env`. The token is sent as a bearer token on
every admin API request and is the master key for the control plane — rotate it
before deploying anywhere public.

Once authenticated, you land on **Agents**, the default tab. The token is
persisted in `localStorage` for this browser only.

---

## 2. Tour of the admin tabs

The admin UI is a single-page app organized as a top tab bar. Each tab maps to
a concrete operational concern. Below is the order most operators follow on
first setup.

### Agents (`/admin/fleet`)

The fleet view. An **agent** is the smallest deployable unit in OpenHermit:
it has its own identity, instructions, sandbox, channels, schedules, secrets,
and skill assignments.

Use this tab to:

- **Create an agent** — pick a slug (e.g. `main`), a model, and a sandbox
  preset. The agent row is created lazily; the runtime is hydrated on first
  use to keep the gateway light.
- **Edit config** — adjust model, system prompt knobs, hydration timeouts.
- **Manage secrets** — per-agent environment variables (API keys, integration
  tokens). Encrypted with `OPENHERMIT_SECRETS_KEY` if set, otherwise stored
  on disk in plaintext (dev only).
- **Manage security policy** — see [docs/access-policy.md](access-policy.md).
- **Start / stop / restart** — explicit lifecycle controls when you need to
  override lazy hydration or pick up new config.

A first-time setup typically has **one agent** named `main`. Add more when you
want isolated identities (e.g. a customer-per-agent SaaS, or specialized
roles).

### Skills (`/admin/skills`)

Skills are reusable bundles of instructions, files, and tool affordances.
OpenHermit ships with two built-ins (`openhermit-usage`, `skill-creator`) and
discovers any folder under `skills/` at the repo root.

Use this tab to:

- **Browse the skill library** — every skill registered with the gateway.
- **Enable / disable per agent** — granular assignment.
- **Enable globally** — fan-out to every agent (`--all` from the CLI).

See [docs/skills.md](skills.md) for the file format.

### MCP (`/admin/mcp-servers`)

[Model Context Protocol](https://modelcontextprotocol.io) servers. Register
external MCP servers once at the gateway, then assign them to specific agents
or to the whole fleet.

Common use cases: GitHub, filesystem, browser automation, internal tools.
See [docs/mcp-servers.md](mcp-servers.md).

### Schedules (`/admin/schedules`)

Cron and one-shot jobs. Each schedule belongs to an agent and triggers a
session with a prompt at the configured time.

Typical uses: daily standup digest, hourly inbox sweep, periodic memory
compaction. Each run records timeout, concurrency policy, and error backoff;
runs are visible from the panel.

### Channels (`/admin/channels`)

Channel adapters (Telegram, Discord, Slack, plus the built-in CLI and Web
channels). Enabling a channel attaches it to an agent and starts the adapter
process — the agent will start receiving events from that surface.

For Telegram/Discord/Slack you provide channel-specific secrets (bot tokens,
signing secrets, etc.). See [docs/channel-adapter.md](channel-adapter.md).

### Sandboxes (`/admin/sandboxes`)

Per-agent execution environments where tool calls actually run. Three backends:

- **docker** — local containers (default for self-hosting).
- **e2b** — [E2B](https://e2b.dev) cloud sandboxes.
- **daytona** — [Daytona](https://www.daytona.io) cloud workspaces.

The panel shows lifecycle state, resource use, and the underlying handle.
**Sandbox presets** define resource shape (CPU, memory, image). See
[docs/sandbox-model.md](sandbox-model.md).

### Users (`/admin/users`)

End-users of your agents. Each user has identities across channels (e.g. a
Telegram ID, a web session, a CLI device) that are reconciled into a single
user record. Roles: `owner`, `user`, `guest`.

Use this tab to inspect identity links, see which agents a user can talk to,
and revoke access.

### Stats (`/admin/stats`)

High-level health: agents online, sessions in flight, recent error rate,
queue depth, sandbox utilization. The first place to look when "something
feels off."

### Logs (`/admin/logs`)

Structured gateway logs with filtering. Equivalent to `hermit logs -f` but
filterable in the browser. Use it to trace a specific request or watch a
deploy land.

### Config (`/admin/config`)

Gateway-level configuration loaded from `.env` and config sources. Read-only
view of resolved values plus an indicator of where each value came from.
Use this to confirm a deploy picked up the env vars you expected.

---

## 3. The minimum viable setup

For a single-operator self-host, this sequence gets you to a working chat:

1. **Set required env vars** in `.env`:
   - `DATABASE_URL` — Postgres connection string.
   - `GATEWAY_ADMIN_TOKEN` — admin bearer token (rotate from the dev default).
   - `GATEWAY_JWT_SECRET` — signing secret for end-user JWTs.
   - `OPENHERMIT_SECRETS_KEY` — 32-byte base64 key for encrypted secrets.
   - At least one model provider key (e.g. `OPENROUTER_API_KEY`).
2. **Start the gateway**: `npm run dev:gateway` (or `hermit gateway start`).
3. **Sign in to `/admin/`** with your admin token.
4. **Create an agent** named `main` on the Agents tab.
5. **Set the model provider secret** on the agent (Secrets dialog).
6. **Start the web app**: `npm run dev:web` and visit `http://127.0.0.1:4310`.
7. **Chat** — pick the agent and send a message.

Optional next steps:

- Enable `openhermit-usage` and `skill-creator` skills on the agent.
- Wire a Telegram or Discord bot from the Channels tab.
- Add a daily schedule for digest-style automation.
- Plug in an MCP server for GitHub or filesystem access.

---

## 4. Common pitfalls

- **`OPENHERMIT_SECRETS_KEY not set`** — secrets fall back to plaintext on
  disk. Fine for local dev; never deploy that way.
- **`GATEWAY_ADMIN_TOKEN` is still the dev default** — the gateway refuses to
  start in production with `dev-admin-token` or `change-me`. Rotate it.
- **`/api/agents/{id}/channels` returns 500** — usually means the agent
  hasn't been hydrated yet or the channel adapter package isn't installed.
  Hit "Start" on the agent first.
- **Sandbox stuck in `creating`** — check the Docker daemon (or your cloud
  provider credentials) and look at the Logs tab for the actual error.
- **A skill change isn't reflected** — skills are synced into the sandbox on
  agent start; restart the agent after enabling/disabling skills.

---

## 5. Where to go next

- [docs/architecture.md](architecture.md) — how the pieces fit together.
- [docs/cli.md](cli.md) — full `hermit` CLI reference for everything the
  admin UI does.
- [docs/access-policy.md](access-policy.md) — who can do what to whom.
- [docs/skills.md](skills.md) and [docs/mcp-servers.md](mcp-servers.md) —
  extending agents with capabilities.
- [docs/channel-adapter.md](channel-adapter.md) — building a new channel.
