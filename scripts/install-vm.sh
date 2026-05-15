#!/usr/bin/env bash
# OpenHermit one-shot installer for a fresh Ubuntu 22.04+ / Debian 12+ VM.
#
# Run as root (or with sudo). Idempotent — safe to re-run.
#
#   curl -fsSL https://raw.githubusercontent.com/louz514/openhermit/main/scripts/install-vm.sh \
#     | sudo bash -s -- --domain openhermit.example.com --email you@example.com
#
# What it does:
#   1. Installs Node 22, Postgres 16, Caddy, Docker, git
#   2. Creates a postgres role + db (openhermit / openhermit)
#   3. Clones the repo into /opt/openhermit
#   4. Builds the gateway
#   5. Writes /etc/openhermit.env with generated secrets
#   6. Installs a systemd unit for the gateway
#   7. Configures Caddy to serve https://<domain> -> 127.0.0.1:4000

set -euo pipefail

DOMAIN=""
EMAIL=""
REPO="${OPENHERMIT_REPO:-https://github.com/louz514/openhermit.git}"
BRANCH="${OPENHERMIT_BRANCH:-main}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)  DOMAIN="$2"; shift 2 ;;
    --email)   EMAIL="$2"; shift 2 ;;
    --repo)    REPO="$2"; shift 2 ;;
    --branch)  BRANCH="$2"; shift 2 ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

if [[ -z "$DOMAIN" ]]; then
  echo "Usage: install-vm.sh --domain <fqdn> [--email <admin@example.com>]" >&2
  exit 1
fi

if [[ $EUID -ne 0 ]]; then
  echo "Run as root (use sudo)." >&2
  exit 1
fi

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

# ── 1. apt deps ─────────────────────────────────────────────────────────
log "Installing apt packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg git build-essential \
  postgresql postgresql-contrib \
  debian-keyring debian-archive-keyring apt-transport-https

# Node 22 (NodeSource)
if ! command -v node >/dev/null || ! node -v | grep -q '^v22'; then
  log "Installing Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

# Caddy
if ! command -v caddy >/dev/null; then
  log "Installing Caddy"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

# Docker (optional — only if you want the docker exec backend)
if ! command -v docker >/dev/null; then
  log "Installing Docker"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io
fi

# ── 2. postgres ─────────────────────────────────────────────────────────
log "Configuring Postgres"
PG_PASS="$(openssl rand -hex 16)"

sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='openhermit'" \
  | grep -q 1 \
  || sudo -u postgres psql -c "CREATE ROLE openhermit LOGIN PASSWORD '$PG_PASS';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='openhermit'" \
  | grep -q 1 \
  || sudo -u postgres createdb -O openhermit openhermit

# If the role already existed (rerun), reset its password to what we generated.
sudo -u postgres psql -c "ALTER ROLE openhermit WITH PASSWORD '$PG_PASS';" >/dev/null

# ── 3. clone + build ────────────────────────────────────────────────────
log "Cloning $REPO @ $BRANCH"
if [[ ! -d /opt/openhermit/.git ]]; then
  git clone --branch "$BRANCH" "$REPO" /opt/openhermit
else
  git -C /opt/openhermit fetch origin "$BRANCH"
  git -C /opt/openhermit checkout "$BRANCH"
  git -C /opt/openhermit reset --hard "origin/$BRANCH"
fi

log "Installing npm deps + building"
cd /opt/openhermit
npm install --no-audit --no-fund
npm run build

# ── 4. env + systemd ────────────────────────────────────────────────────
log "Writing /etc/openhermit.env"
ENV_FILE=/etc/openhermit.env
if [[ ! -f "$ENV_FILE" ]]; then
  ADMIN_TOKEN="$(openssl rand -hex 32)"
  SECRETS_KEY="$(openssl rand -base64 32)"
  cat > "$ENV_FILE" <<EOF
DATABASE_URL=postgresql://openhermit:${PG_PASS}@127.0.0.1:5432/openhermit
GATEWAY_HOST=127.0.0.1
GATEWAY_PORT=4000
GATEWAY_ADMIN_TOKEN=${ADMIN_TOKEN}
OPENHERMIT_SECRETS_KEY=${SECRETS_KEY}
OPENHERMIT_HOME=/var/lib/openhermit
NODE_ENV=production
EOF
  chmod 600 "$ENV_FILE"
  echo "Generated admin token: $ADMIN_TOKEN"
  echo "(also stored in $ENV_FILE — keep this file safe)"
fi

# Persistent state dir
install -d -m 700 -o root -g root /var/lib/openhermit

log "Installing systemd unit"
cat > /etc/systemd/system/openhermit-gateway.service <<'EOF'
[Unit]
Description=OpenHermit gateway + agent runtime
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
WorkingDirectory=/opt/openhermit
EnvironmentFile=/etc/openhermit.env
ExecStart=/usr/bin/node apps/gateway/dist/index.js
Restart=on-failure
RestartSec=5
LimitNOFILE=65536

# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/openhermit
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now openhermit-gateway

# ── 5. caddy ────────────────────────────────────────────────────────────
log "Configuring Caddy for $DOMAIN"
CADDYFILE=/etc/caddy/Caddyfile
EMAIL_LINE=""
if [[ -n "$EMAIL" ]]; then
  EMAIL_LINE="    email $EMAIL"
fi

cat > "$CADDYFILE" <<EOF
{
${EMAIL_LINE}
}

${DOMAIN} {
    reverse_proxy 127.0.0.1:4000 {
        flush_interval -1
        transport http {
            response_header_timeout 0
        }
    }
}
EOF

systemctl reload caddy || systemctl restart caddy

# ── 6. ufw (basic firewall) ─────────────────────────────────────────────
if command -v ufw >/dev/null; then
  log "Configuring ufw"
  ufw allow OpenSSH || true
  ufw allow 80/tcp || true
  ufw allow 443/tcp || true
  yes | ufw enable || true
fi

log "Done."
cat <<EOF

──────────────────────────────────────────────────────────────────────────
OpenHermit gateway is up.

   Backend URL:   https://${DOMAIN}
   Health check:  curl https://${DOMAIN}/health
   Admin token:   (cat /etc/openhermit.env | grep ADMIN)
   Logs:          journalctl -u openhermit-gateway -f
   Restart:       systemctl restart openhermit-gateway

Open your Vercel-deployed web UI and enter https://${DOMAIN} on the
connect screen.
──────────────────────────────────────────────────────────────────────────
EOF
