# Multi-stage build for the OpenHermit gateway + agent runtime.
# The web UI is deployed separately (Vercel) and not built in this image.

ARG NODE_VERSION=22

# ── Stage 1: install + build ────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS builder

WORKDIR /app

# Copy manifests first so npm install is cached when only source changes.
COPY package.json package-lock.json* tsconfig.base.json tsconfig.json ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts

RUN npm install --workspaces --include-workspace-root --no-audit --no-fund

# Build TS for all workspaces. Skip building the web UI bundle — it ships
# from Vercel — but the gateway still needs its own admin UI bundle.
RUN npx tsc -b \
 && npm run build:ui -w @openhermit/gateway

# Drop dev deps from node_modules to shrink the runtime image.
RUN npm prune --omit=dev --workspaces --include-workspace-root

# ── Stage 2: runtime ────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS runtime

ENV NODE_ENV=production \
    GATEWAY_HOST=0.0.0.0 \
    GATEWAY_PORT=4000 \
    OPENHERMIT_HOME=/data

WORKDIR /app

# Minimal runtime deps. Add `docker-cli` here only if you actually run
# Docker-in-Docker for sandbox exec on this host — most managed PaaS
# providers do not allow that, so keep the image lean and use the e2b
# exec backend (or disable container tools) by default.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app /app

# Persistent agent workspaces, secrets, gateway.json. Mount a volume here.
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 4000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "apps/gateway/dist/index.js"]
