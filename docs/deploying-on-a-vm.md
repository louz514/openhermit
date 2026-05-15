# Deploying OpenHermit to a Linux VM (no Fly, no Vercel backend)

This is the **path of least resistance** without using Fly. Works on any
Ubuntu 22.04+ / Debian 12+ box. ~10 minutes from `ssh` to live URL.

## 1. Pick a host

| Provider     | Plan   | Price       | Notes                                          |
| ------------ | ------ | ----------- | ---------------------------------------------- |
| Hetzner      | CX22   | €4.51/mo    | Best value. Card required at signup.           |
| DigitalOcean | basic  | $4/mo       | $200 free credit if you use a referral link.   |
| Linode       | Nanode | $5/mo       | $100 free credit for new accounts.             |
| Vultr        | Cloud  | $3.50/mo    | Cheapest, $250 trial credit on new accounts.   |

Any of these has Docker, plenty of RAM (1 GB) for the gateway, and
gives you a public IPv4.

## 2. Point a domain at it

Create an `A` record on a domain you own pointing at the VM's IP.
Free options if you don't have one:

- A subdomain of a domain you already own (`openhermit.yourdomain.com`)
- A free DuckDNS subdomain (`yourname.duckdns.org`)

## 3. Run the installer

SSH into the box as root (or a sudoer) and run:

```bash
curl -fsSL https://raw.githubusercontent.com/louz514/openhermit/main/scripts/install-vm.sh \
  | sudo bash -s -- --domain openhermit.example.com --email you@example.com
```

The script is idempotent. It:

1. Installs Node 22, Postgres 16, Caddy, Docker, git
2. Creates a Postgres role + database (`openhermit` / random password)
3. Clones the repo to `/opt/openhermit` and runs `npm run build`
4. Generates `/etc/openhermit.env` with random `GATEWAY_ADMIN_TOKEN` and
   `OPENHERMIT_SECRETS_KEY`
5. Installs and starts the `openhermit-gateway` systemd service
6. Configures Caddy to terminate TLS on your domain and reverse-proxy
   to `127.0.0.1:4000`
7. Opens 80/443 in `ufw`

When it finishes it prints your admin token. Save it.

## 4. Connect the Vercel UI

The web UI deployed on Vercel asks for a "gateway URL" on the connect
screen. Enter `https://openhermit.example.com` and authenticate with
the admin token printed by the installer.

## 5. Operations

```bash
# Logs
journalctl -u openhermit-gateway -f

# Restart
systemctl restart openhermit-gateway

# Update to latest main
cd /opt/openhermit
sudo git pull
sudo npm install --no-audit --no-fund
sudo npm run build
sudo systemctl restart openhermit-gateway

# Read your secrets back
sudo cat /etc/openhermit.env
```

## Why this and not Fly / Render / serverless?

- Fly demands a credit card up front even on the free tier.
- Render's free web service sleeps after 15 min of idle traffic, which
  breaks long-lived SSE streams and resets in-memory session state.
- Vercel / Cloudflare Workers are serverless FaaS — incompatible with
  the gateway's persistent SSE, cron schedulers, and channel sockets.

A small VM with systemd + Caddy is the simplest match for the gateway's
runtime model and matches the upstream
[deploying-with-caddy.md](deploying-with-caddy.md) reference.
