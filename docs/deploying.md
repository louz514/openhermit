# Deploying OpenHermit

OpenHermit splits cleanly into a static web client and a long-running
backend. The recommended split is:

- **Web UI** → Vercel (static, no env vars at build time).
- **Gateway + agent runtime** → Fly.io (always-on container, persistent
  volume, Docker-friendly).
- **Postgres** → Neon (managed serverless Postgres) or Fly Postgres.

The web UI stores the gateway URL in `localStorage`, set on first
connect, so the same Vercel build can point at staging/prod by entering
a different URL — no rebuild needed.

## 1. Web UI on Vercel

Files: [vercel.json](../vercel.json)

1. `vercel link` (or import the GitHub repo on the Vercel dashboard).
2. Vercel will pick up `vercel.json` automatically:
   - Install: `npm install --workspaces --include-workspace-root`
   - Build: `npm run build -w @openhermit/web`
   - Output: `apps/web/public`
3. `vercel deploy --prod`.

No environment variables are required for the web build. Users enter the
gateway URL on first load.

## 2. Backend on Fly.io

Files: [Dockerfile](../Dockerfile), [fly.toml](../fly.toml),
[.dockerignore](../.dockerignore)

```bash
# One-time
fly launch --no-deploy --copy-config            # registers the app
fly volumes create openhermit_data --size 3 \
  --region iad                                  # or your region
```

Provision Postgres (pick one):

```bash
# Option A: Neon (recommended — serverless, free tier)
#   1. Create a project at https://neon.tech
#   2. Copy the connection string (with ?sslmode=require)

# Option B: Fly Postgres
fly postgres create --name openhermit-pg
fly postgres attach openhermit-pg              # sets DATABASE_URL
```

Set required secrets:

```bash
fly secrets set \
  DATABASE_URL='postgres://USER:PASSWORD@HOST/DBNAME?sslmode=require' \
  OPENHERMIT_SECRETS_KEY="$(openssl rand -base64 32)" \
  GATEWAY_ADMIN_TOKEN="$(openssl rand -hex 32)"
```

Optional secrets (per provider you actually use):

```bash
fly secrets set \
  ANTHROPIC_API_KEY=... \
  OPENAI_API_KEY=... \
  OPENROUTER_API_KEY=... \
  E2B_API_KEY=...                # required for the e2b sandbox backend
```

Deploy:

```bash
fly deploy
```

`runMigrations()` runs automatically at boot; the schema is applied to
your Postgres before the HTTP listener starts.

### Sandbox / exec backend on managed hosts

The default exec backend is `docker`, which shells out to `docker run`.
**Most managed hosts (including Fly machines without DinD) cannot run
this**. Two practical options:

1. **Use the e2b backend** — set `E2B_API_KEY` and configure agents with
   `exec.backends: [{ type: 'e2b' }]`. No Docker needed.
2. **Disable container/exec tools per agent** — leave the gateway
   running but don't ship `exec_run` / `container_*` tools to agents.

`type: 'host'` exists but runs commands directly on the gateway machine —
**unsafe in production**, only acceptable for fully trusted single-user
deployments.

### Channel adapters (Discord/Slack/Telegram)

These open long-lived connections (Discord gateway socket, Telegram
long-poll). They run inside the gateway process and benefit from the
`min_machines_running = 1` setting in [fly.toml](../fly.toml). Auto-stop
will hibernate the machine after idle HTTP traffic — fine for a
web-only deployment, but **disable `auto_stop_machines` if you rely on
channel adapters**.

## 3. Wiring web → backend

After the first deploy:

1. Note your Fly app URL: `https://openhermit-backend.fly.dev`.
2. Open the Vercel-deployed web UI.
3. On the connect screen, enter:
   - Gateway URL: `https://openhermit-backend.fly.dev`
   - Display name: anything — used as your owner identity.
4. The browser registers a device key, mints a JWT against the gateway,
   and persists the gateway URL.

## What does *not* work on serverless

For completeness — these are the reasons the backend cannot run on
Vercel functions or any short-lived FaaS:

- SSE streams stay open for the entire model turn (often minutes).
- The scheduler and channel adapters are always-on background loops.
- Agent in-memory state (`AgentRunner.sessions`, approval gates,
  langfuse turn context) doesn't survive function recycling.
- The Docker exec backend needs a real OS with `docker` on PATH.
