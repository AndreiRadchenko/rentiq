#!/usr/bin/env bash
set -euo pipefail

# Production database backup script
# Usage: ./scripts/backup-prod.sh
# Cron:  0 2 * * * /opt/rentiq/scripts/backup-prod.sh

BACKUP_DIR="/opt/rentiq/backups/production"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/rentiq_prod_${TIMESTAMP}.sql.gz"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Perform backup
pg_dump "${DATABASE_URL}" | gzip > "$BACKUP_FILE"

# Remove old backups
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +${RETENTION_DAYS} -delete

echo "[$(date)] Production backup completed: ${BACKUP_FILE}"
