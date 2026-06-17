#!/usr/bin/env bash
# DEV deploy ONLY. Refuses any production target.
#
# Brings up the canonical self-hosted stack (web + api + postgres + redis +
# minio + mailhog) from the repo-root docker-compose.yml. The one-shot `migrate`
# service runs `prisma migrate deploy` + seed automatically. Reads the single
# repo-root `.env` (see .env.example) — same content as `pnpm dev`.
#
# Production deploys are NEVER performed here. (Vercel Git integration may also
# build the web frontend separately; see docs/DEPLOYMENT.md.)
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET="${DEPLOY_ENV:-${1:-dev}}"
PROD_RE='^(prod|production)$'
if [[ "$TARGET" =~ $PROD_RE ]]; then
  echo "[deploy] REFUSED: production deploys are not allowed from this script (DEV only)." >&2
  exit 1
fi
if [ "$TARGET" != "dev" ]; then
  echo "[deploy] REFUSED: unknown target '$TARGET' (only 'dev' is permitted)." >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo "[deploy] REFUSED: repo-root .env not found. Copy .env.example to .env first." >&2
  exit 1
fi

# Set CLEAN_DB=1 to drop volumes for a fresh migrate+seed (recommended for demos;
# required if the DB predates the add_missing_schema_drift migration — see runbook).
if [ "${CLEAN_DB:-0}" = "1" ]; then
  echo "[deploy] CLEAN_DB=1 — dropping volumes for a clean migrate+seed..."
  docker compose down -v
fi

echo "[deploy] target=DEV — building images and bringing up the stack..."
# Compose builds the api/web images, starts infra, runs the one-shot migrate
# service (migrate deploy + seed), then starts api + web. --wait blocks until
# healthy / migrate completes.
docker compose up -d --build --wait

echo "[deploy] stack up. Health check:"
curl -fsS http://localhost:4000/health >/dev/null 2>&1 && echo "[deploy]   api  :4000 OK" || echo "[deploy]   api  :4000 not ready yet"
echo "[deploy] OK (env=dev) — web :3000, api :4000, seeded demo@wealthme.id"
