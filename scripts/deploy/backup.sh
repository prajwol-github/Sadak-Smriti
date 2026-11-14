#!/usr/bin/env bash
#
# backup.sh — Automated database dump and rotation
# Usage: ./scripts/deploy/backup.sh [production|staging]
# Cron example (every night at 02:15):
# 15 2 * * * /srv/sadak/production/app/scripts/deploy/backup.sh production >> /srv/sadak/backups/backup.log 2>&1
#
set -euo pipefail

ENV="${1:-production}"
BACKUP_DIR="/srv/sadak/backups"
TIMESTAMP="$(date +'%Y-%m-%d_%H%M%S')"

if [ "$ENV" = "staging" ]; then
  CONTAINER="sadak-postgres-staging"
  DB="sadak_staging"
else
  CONTAINER="sadak-postgres-production"
  DB="sadak"
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

DUMP_FILE="$BACKUP_DIR/sadak-${ENV}-${TIMESTAMP}.dump"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Starting backup of $CONTAINER ($DB)..."

# Dump custom format (-Fc)
docker exec "$CONTAINER" pg_dump -U postgres -Fc "$DB" > "$DUMP_FILE"
chmod 600 "$DUMP_FILE"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Backup saved to $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1))"

# Rotate backups older than 14 days
echo "Rotating backups older than 14 days..."
find "$BACKUP_DIR" -name "sadak-${ENV}-*.dump" -type f -mtime +14 -delete

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Backup completed successfully."

