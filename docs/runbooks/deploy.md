# Deploying Sadak Smriti to a Hostinger VPS (Staging & Production)

Updated 14 Nov 2026. This guide details how to provision and deploy Sadak Smriti across two isolated environments on a single Hostinger VPS (Ubuntu 24.04 LTS):
* **Production**: `example.org` & `www.example.org` (Web: `127.0.0.1:3000`, DB: `127.0.0.1:5433`)
* **Staging**: `staging.example.org` (Web: `127.0.0.1:3001`, DB: `127.0.0.1:5434`)

Replace `example.org` and `203.0.113.10` with your actual domain and server IP address.

```text
Visitors ─ HTTPS ─> Cloudflare ─ HTTPS ─> Caddy (port 443, Cloudflare IPs only)
                                            ├─ example.org         ──> Next.js:3000 (sadak-web-production)
                                            │                          Worker       (sadak-worker-production)
                                            │                          PostgreSQL   (127.0.0.1:5433)
                                            ├─ staging.example.org ──> Next.js:3001 (sadak-web-staging)
                                            │                          Worker       (sadak-worker-staging)
                                            │                          PostgreSQL   (127.0.0.1:5434)
                                            └─ /tiles/* (both)     ──> Direct from disk (/public/tiles)
```

---

## Part 1. Provision the VPS with `setup-server.sh`

On your local machine, generate an SSH key if needed:
```powershell
ssh-keygen -t ed25519 -C "sadak-deploy"
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub
```

Connect to the VPS as root:
```bash
ssh root@203.0.113.10
```

Add the `deploy` user with sudo privileges and authorized keys:
```bash
adduser deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
nano /home/deploy/.ssh/authorized_keys # paste your public key
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
```

Open a second terminal and verify `ssh deploy@203.0.113.10` works. Then disable password & root SSH:
```bash
sudo tee /etc/ssh/sshd_config.d/00-hardening.conf <<EOF
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
EOF
sudo sshd -t && sudo systemctl restart ssh
```

Now run the server provisioning script:
```bash
# Upload or clone the repo as deploy, then execute:
sudo bash scripts/deploy/setup-server.sh
```

`setup-server.sh` automatically:
1. Updates base packages and installs essential tools (`fail2ban`, `unattended-upgrades`, `ufw`).
2. Configures the UFW firewall, allowing OpenSSH and restricting port 443 **strictly** to Cloudflare's published IP ranges.
3. Installs Docker CE & Docker Compose plugin.
4. Installs Node.js 26 & `pnpm@12.18.0`.
5. Installs Caddy web server.
6. Creates the `sadak` system user and `/srv/sadak/production`, `/srv/sadak/staging`, and `/srv/sadak/backups`.

---

## Part 2. Upload Large Assets (PMTiles Basemap)

Because large binary files are ignored in Git, copy the basemap and raw place data to the server from your local computer:

```powershell
# From local project folder
scp public\tiles\nepal-basemap.pmtiles deploy@203.0.113.10:/tmp/
scp -r data\raw deploy@203.0.113.10:/tmp/raw
```

On the server, as `deploy`:
```bash
# For Staging:
sudo mkdir -p /srv/sadak/staging/app/public/tiles /srv/sadak/staging/app/data
sudo cp /tmp/nepal-basemap.pmtiles /srv/sadak/staging/app/public/tiles/
sudo cp -r /tmp/raw /srv/sadak/staging/app/data/raw

# For Production:
sudo mkdir -p /srv/sadak/production/app/public/tiles /srv/sadak/production/app/data
sudo mv /tmp/nepal-basemap.pmtiles /srv/sadak/production/app/public/tiles/
sudo mv /tmp/raw /srv/sadak/production/app/data/raw

sudo chown -R sadak:sadak /srv/sadak
```

---

## Part 3. Environment Secrets (Staging & Production)

All secrets are kept outside git in mode `600` files under `/srv/sadak/`:
* Staging: `/srv/sadak/staging/.env.staging`
* Production: `/srv/sadak/production/.env.production`

### 3.1 Create Staging Environment
As `sadak`:
```bash
cp /srv/sadak/staging/app/.env.staging.example /srv/sadak/staging/.env.staging
chmod 600 /srv/sadak/staging/.env.staging
nano /srv/sadak/staging/.env.staging
```
Generate random secrets:
```bash
openssl rand -hex 24      # 4 times: POSTGRES, MIGRATOR, APP, READONLY passwords
openssl rand -hex 32      # 2 times: IP_HASH_SECRET, CONTACT_ENCRYPTION_KEY
openssl rand -base64 32   # BETTER_AUTH_SECRET
```
Fill in the Google OAuth and Cloudflare Turnstile keys configured for `https://staging.example.org`.

### 3.2 Create Production Environment
As `sadak`:
```bash
cp /srv/sadak/production/app/.env.production.example /srv/sadak/production/.env.production
chmod 600 /srv/sadak/production/.env.production
nano /srv/sadak/production/.env.production
```
Generate separate secrets (never reuse staging secrets in production!).
Fill in the Google OAuth and Cloudflare Turnstile keys configured for `https://example.org`.

---

## Part 4. Configure Caddy & Cloudflare

### 4.1 Cloudflare Origin Certificates
In Cloudflare: **SSL/TLS > Origin Server > Create Certificate**.
* Create one certificate for `example.org`, `*.example.org`.
* Save the certificate and private key on the server:
```bash
sudo nano /etc/caddy/certs/origin-production.pem
sudo nano /etc/caddy/certs/origin-production.key
sudo nano /etc/caddy/certs/origin-staging.pem
sudo nano /etc/caddy/certs/origin-staging.key

sudo chown -R caddy:caddy /etc/caddy/certs
sudo chmod 600 /etc/caddy/certs/*.key
```

### 4.2 Install Caddy Configuration
```bash
sudo cp /srv/sadak/production/app/infra/caddy/Caddyfile /etc/caddy/Caddyfile
# Edit domain names in /etc/caddy/Caddyfile to match your actual domains
sudo nano /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

---

## Part 5. Automated Deployment with `deploy.sh`

Deploy staging first:
```bash
# As sadak (or deploy with sudo):
/srv/sadak/staging/app/scripts/deploy/deploy.sh staging
```

The script will:
1. Verify the existence of `.env.staging` (chmod 600).
2. Pull latest git commits (`git pull --ff-only`).
3. Install dependencies (`pnpm install --frozen-lockfile`).
4. Start the staging PostgreSQL container (`sadak-postgres-staging` on port 5434).
5. Run migrations (`pnpm db:migrate`) and sync news outlets.
6. Build the standalone Next.js application (`pnpm build`).
7. Copy `.next/static` and `public/` into `.next/standalone/`.
8. Configure and restart systemd services (`sadak-web-staging`, `sadak-worker-staging`).
9. Probe `http://127.0.0.1:3001/ne` for HTTP 200 OK.

Once staging is verified end-to-end, deploy production:
```bash
/srv/sadak/production/app/scripts/deploy/deploy.sh production
```

*(Optional) To populate initial factual crashes and verified victims into staging or production:*
```bash
# Staging:
cd /srv/sadak/staging/app
ENV_FILE=/srv/sadak/staging/.env.staging pnpm db:seed

# Production:
cd /srv/sadak/production/app
ENV_FILE=/srv/sadak/production/.env.production pnpm db:seed
```

---

## Part 6. Creating the First Staff Admin

Sign in to Google once on the web UI (e.g. `https://staging.example.org/en/login`).
Then promote the account to admin via CLI:
```bash
# Staging:
cd /srv/sadak/staging/app
ENV_FILE=/srv/sadak/staging/.env.staging pnpm users:role you@example.org admin

# Production:
cd /srv/sadak/production/app
ENV_FILE=/srv/sadak/production/.env.production pnpm users:role you@example.org admin
```
Sign in again, navigate to `/en/review`, and configure your authenticator app (TOTP) and backup codes.

---

## Part 7. Automated Backups & Maintenance

Install the backup cron job for the `sadak` user:
```bash
crontab -e
```
Add:
```cron
# Daily production database dump at 02:15 UTC
15 2 * * * /srv/sadak/production/app/scripts/deploy/backup.sh production >> /srv/sadak/backups/backup.log 2>&1

# Daily staging database dump at 02:45 UTC
45 2 * * * /srv/sadak/staging/app/scripts/deploy/backup.sh staging >> /srv/sadak/backups/backup.log 2>&1
```

The backup script automatically rotates and purges backups older than 14 days.
To restore a backup into a database:
```bash
docker exec -i sadak-postgres-production pg_restore -U postgres -d sadak --clean --if-exists < /srv/sadak/backups/sadak-production-YYYY-MM-DD.dump

---

## Part 8. Final Checks Before Going Public

Run these from the VPS (as `deploy` or `sadak`) and your local machine before announcing the site.

### 8.1 Auth Route Allowlist
Confirm all unlisted auth endpoints return 404 (not 200 or 500):
```bash
# Must return 404
curl -s -o /dev/null -w "%{http_code}" -X POST https://example.org/api/auth/two-factor/disable
curl -s -o /dev/null -w "%{http_code}" -X POST https://example.org/api/auth/sign-in/email
# Must return 200
curl -s -o /dev/null -w "%{http_code}" https://example.org/api/auth/callback/google
```

### 8.2 SSH Hardening
```bash
# Root login must be refused
ssh root@203.0.113.10        # expect "Permission denied (publickey)"
# Password auth must be refused
ssh -o PreferredAuthentications=password deploy@203.0.113.10  # expect "Permission denied"
```

### 8.3 Firewall
```bash
sudo ufw status verbose
# Expect: 22 open from anywhere, 443 open from Cloudflare IPs only, all else DENY
```

### 8.4 Direct IP Access Is Blocked
From your local machine (outside Cloudflare):
```bash
curl --max-time 5 https://203.0.113.10/   # must time out or connection refused
```

### 8.5 App Ports Not Exposed Externally
On the VPS:
```bash
ss -tlnp | grep -E '3000|3001'
# Both must show 127.0.0.1:3000 and 127.0.0.1:3001 — NOT 0.0.0.0
ss -tlnp | grep -E '5433|5434'
# Both must show 127.0.0.1:5433 and 127.0.0.1:5434 — NOT 0.0.0.0
```

### 8.6 Env File Permissions
```bash
ls -l /srv/sadak/production/.env.production
ls -l /srv/sadak/staging/.env.staging
# Both must show: -rw------- (600), owner sadak
```

### 8.7 Secrets Are Not Test / Example Values
Open each env file and confirm:
- `TURNSTILE_SECRET_KEY` is **not** `0x4AAAAAAAAAA...` (the Cloudflare test key)
- `TURNSTILE_SITE_KEY` is **not** `1x00000000000000000000AA` (the Cloudflare test key)
- `BETTER_AUTH_SECRET` is a random 32-byte base64 string (not "changeme" or empty)
- `GOOGLE_CLIENT_SECRET` is set and matches the OAuth app for the correct domain

### 8.8 HTTPS Configuration
```bash
# Session cookie must be Secure and HttpOnly
curl -sI https://example.org/en | grep -i set-cookie
# HSTS must be present on production
curl -sI https://example.org/ | grep -i strict-transport
# staging.example.org intentionally has no HSTS (expected)
```
Also verify:
- `BETTER_AUTH_URL` in `.env.production` starts with `https://` (not `http://`)
- Cloudflare SSL/TLS mode is set to **Full (strict)**

### 8.9 Access Control (Sign-Out Test)
In a fresh private/incognito browser window (not signed in):
- `/en/review` → should return 404 or redirect to login (not show content)
- `/en/admin/users` → should return 404 (not show user list)

### 8.10 Session IP Hashing
After signing in, check the `sessions` table:
```sql
SELECT ip_address FROM sessions LIMIT 3;
-- All values must be 64-character hex strings (SHA-256 hashes), never raw IPs
```

### 8.11 Worker Is Running
```bash
journalctl -u sadak-worker-production -n 30 --no-pager
# Expect a "retention:" log line within the last 24 hours
```

### 8.12 Database Backup Has Been Tested
```bash
# Confirm a dump exists
ls -lh /srv/sadak/backups/sadak-production-*.dump

# Do a trial restore into a scratch database to verify the dump is not corrupt
docker exec sadak-postgres-production createdb -U postgres sadak_restore_test
docker exec -i sadak-postgres-production pg_restore -U postgres -d sadak_restore_test \
  < /srv/sadak/backups/sadak-production-$(date +%Y-%m-%d).dump
docker exec sadak-postgres-production dropdb -U postgres sadak_restore_test
```

### 8.13 Key Escrow
Before going live, confirm that **a second trusted person** holds:
- SSH private key (or knows the server password reset procedure)
- Cloudflare account access
- Google Cloud / OAuth console access
- Hostinger VPS control panel access
- Production `.env.production` contents (stored in a shared password manager)

If any check above fails, **stop and fix it before announcing the site.**
```
