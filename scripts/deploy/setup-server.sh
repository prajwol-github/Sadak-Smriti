#!/usr/bin/env bash
#
# setup-server.sh — Initial VPS provisioning for Ubuntu 24.04 LTS (Hostinger)
# Run as root or a user with sudo privileges.
#
set -euo pipefail

echo "==> [1/7] Updating apt repositories and base packages..."
apt-get update && apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg ufw fail2ban unattended-upgrades rsync git

echo "==> [2/7] Configuring UFW firewall for OpenSSH & Cloudflare..."
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH

# Restrict port 443 strictly to Cloudflare's published IP ranges (ADR 0004)
echo "Fetching Cloudflare IP ranges..."
for ip in $(curl -fsS https://www.cloudflare.com/ips-v4) $(curl -fsS https://www.cloudflare.com/ips-v6); do
  ufw allow proto tcp from "$ip" to any port 443 comment "Cloudflare proxy"
done

# Enable firewall and fail2ban
ufw --force enable
systemctl enable --now fail2ban

echo "==> [3/7] Installing Docker & Docker Compose plugin..."
install -m 0755 -d /etc/apt/keyrings
if [ ! -f /etc/apt/keyrings/docker.asc ]; then
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
fi

tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "==> [4/7] Installing Node.js 26 & pnpm..."
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_26.x | bash -
  apt-get install -y nodejs
fi
npm install -g pnpm@12.18.0

echo "==> [5/7] Installing Caddy Web Server..."
if ! command -v caddy >/dev/null 2>&1; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
fi

echo "==> [6/7] Creating 'sadak' system user and directory structure..."
if ! id -u sadak >/dev/null 2>&1; then
  adduser --system --group --home /srv/sadak --shell /bin/bash sadak
  usermod -aG docker sadak
fi

# Multi-environment structure
mkdir -p /srv/sadak/production /srv/sadak/staging /srv/sadak/backups /etc/caddy/certs
chown -R sadak:sadak /srv/sadak
chmod 700 /srv/sadak/backups
chmod 755 /srv/sadak /srv/sadak/production /srv/sadak/staging

echo "==> [7/7] Setup complete!"
echo ""
echo "Next steps:"
echo "1. Put Origin Certificates in /etc/caddy/certs/ (origin-production.pem/key, origin-staging.pem/key)"
echo "2. Copy infra/caddy/Caddyfile to /etc/caddy/Caddyfile and reload caddy"
echo "3. Copy .env.staging and .env.production into /srv/sadak/staging/ and /srv/sadak/production/"
echo "4. Run: ./scripts/deploy/deploy.sh staging"
echo "5. Run: ./scripts/deploy/deploy.sh production"

