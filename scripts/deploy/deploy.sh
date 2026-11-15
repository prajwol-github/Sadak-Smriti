#!/usr/bin/env bash
#
# deploy.sh — Deploy Sadak Smriti to Staging or Production
# Usage: ./scripts/deploy/deploy.sh [staging|production]
#
set -euo pipefail

ENV="${1:-}"
if [ "$ENV" != "staging" ] && [ "$ENV" != "production" ]; then
  echo "Usage: $0 [staging|production]"
  exit 1
fi

echo "========================================================"
echo " Deploying Sadak Smriti [$ENV]"
echo " Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "========================================================"

BASE_DIR="/srv/sadak"
ENV_DIR="$BASE_DIR/$ENV"
APP_DIR="$ENV_DIR/app"
ENV_FILE="$ENV_DIR/.env.$ENV"
COMPOSE_FILE="$APP_DIR/infra/docker-compose.$ENV.yml"

if [ "$ENV" = "production" ]; then
  BRANCH="releases/production"
  WEB_PORT=3011
else
  BRANCH="releases/stage"
  WEB_PORT=3010
fi

# 1. Verify environment secrets file
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: Environment file $ENV_FILE does not exist!"
  echo "Please create it using .env.$ENV.example before running deployment."
  exit 1
fi
chmod 600 "$ENV_FILE"

# 2. Check application directory
if [ ! -d "$APP_DIR" ]; then
  echo "==> Application directory not found. Please clone the repository into $APP_DIR first."
  exit 1
fi

cd "$APP_DIR"

# 3. Pull latest changes if under git
if [ -d ".git" ]; then
  echo "==> Fetching and checking out branch [$BRANCH]..."
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH"
fi

# 4. Install dependencies
echo "==> Installing dependencies with pnpm..."
pnpm install --frozen-lockfile

# 5. Verify / Start Database Container
echo "==> Starting database container for [$ENV]..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --wait

# 6. Apply database migrations
echo "==> Applying database migrations..."
ENV_FILE="$ENV_FILE" pnpm db:migrate

# 7. Sync news outlets
echo "==> Syncing news outlets..."
ENV_FILE="$ENV_FILE" pnpm pipeline:outlets

# 8. Build standalone Next.js application
echo "==> Building Next.js application..."
ENV_FILE="$ENV_FILE" pnpm build

# 9. Prepare standalone assets
echo "==> Preparing standalone static distribution..."
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
rsync -a --delete --exclude tiles public/ .next/standalone/public/

# Ensure public/tiles permissions for Caddy
if [ -d "public/tiles" ]; then
  chmod -R o+rX public/tiles
fi

# 10. Update and restart systemd services
echo "==> Configuring and restarting systemd services..."
sudo cp "$APP_DIR/infra/systemd/sadak-web-$ENV.service" /etc/systemd/system/
sudo cp "$APP_DIR/infra/systemd/sadak-worker-$ENV.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable "sadak-web-$ENV" "sadak-worker-$ENV"
sudo systemctl restart "sadak-web-$ENV" "sadak-worker-$ENV"

# 11. Health check probe
echo "==> Probing application health on 127.0.0.1:$WEB_PORT..."
for i in {1..15}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$WEB_PORT/ne" || true)
  if [ "$STATUS" = "200" ]; then
    echo "SUCCESS: $ENV instance responded with HTTP 200 OK!"
    break
  fi
  echo "Waiting for instance to be ready (attempt $i/15, status: $STATUS)..."
  sleep 2
done

if [ "$STATUS" != "200" ]; then
  echo "WARNING: Health check probe failed with status $STATUS."
  echo "Check service logs: sudo journalctl -u sadak-web-$ENV -n 50 --no-pager"
  exit 1
fi

echo "========================================================"
echo " [$ENV] Deployment successfully completed!"
echo "========================================================"

