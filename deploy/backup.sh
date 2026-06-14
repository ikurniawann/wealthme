#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# WealthMe — PostgreSQL backup script
#
# Required environment variables (load from .env or export before running):
#   POSTGRES_HOST     — database host (e.g. localhost or db)
#   POSTGRES_DB       — database name
#   POSTGRES_USER     — database user
#   POSTGRES_PASSWORD — database password
#
# Usage:
#   ./deploy/backup.sh
#   POSTGRES_HOST=db POSTGRES_DB=wealthme ./deploy/backup.sh
# ---------------------------------------------------------------------------

BACKUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/wealthme_${TIMESTAMP}.sql.gz"
RETAIN_LAST=7

# Validate required env vars
: "${POSTGRES_HOST:?POSTGRES_HOST is not set}"
: "${POSTGRES_DB:?POSTGRES_DB is not set}"
: "${POSTGRES_USER:?POSTGRES_USER is not set}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is not set}"

# Create backup directory if it does not exist
mkdir -p "${BACKUP_DIR}"

echo "[backup] Starting backup of '${POSTGRES_DB}' on '${POSTGRES_HOST}'..."

# Run pg_dump and compress output
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  --host="${POSTGRES_HOST}" \
  --username="${POSTGRES_USER}" \
  --dbname="${POSTGRES_DB}" \
  --no-password \
  --format=plain \
  | gzip > "${BACKUP_FILE}"

echo "[backup] Backup written to: ${BACKUP_FILE}"

# Retain only the last N backups (delete oldest first)
BACKUP_COUNT=$(find "${BACKUP_DIR}" -maxdepth 1 -name "wealthme_*.sql.gz" | wc -l)

if [ "${BACKUP_COUNT}" -gt "${RETAIN_LAST}" ]; then
  DELETE_COUNT=$(( BACKUP_COUNT - RETAIN_LAST ))
  echo "[backup] Pruning ${DELETE_COUNT} old backup(s) (keeping last ${RETAIN_LAST})..."
  find "${BACKUP_DIR}" -maxdepth 1 -name "wealthme_*.sql.gz" \
    | sort \
    | head -n "${DELETE_COUNT}" \
    | xargs rm -f
fi

KEPT=$(find "${BACKUP_DIR}" -maxdepth 1 -name "wealthme_*.sql.gz" | wc -l)
echo "[backup] Done. ${KEPT} backup(s) retained in ${BACKUP_DIR}"
