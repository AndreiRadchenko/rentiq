#!/usr/bin/env bash
set -euo pipefail

# Stage database backup script
# Usage: ./scripts/backup-stage.sh
# Cron:  0 3 * * 0 /opt/rentiq/scripts/backup-stage.sh

BACKUP_DIR="/opt/rentiq/backups/stage"
RETENTION_DAYS=14
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/rentiq_stage_${TIMESTAMP}.sql.gz"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Perform backup (stage uses port 5433)
pg_dump -p 5433 "${DATABASE_URL}" | gzip > "$BACKUP_FILE"

# Remove old backups
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +${RETENTION_DAYS} -delete

echo "[$(date)] Stage backup completed: ${BACKUP_FILE}"
