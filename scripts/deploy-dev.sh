#!/usr/bin/env bash
# Deploy to the DEV environment ONLY. Refuses any production target.
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

PNPM="corepack pnpm"
echo "[deploy] target=DEV — building..."
$PNPM install --frozen-lockfile 2>/dev/null || $PNPM install
$PNPM turbo run build

# --- DEV deploy step (extend here when DEV infra is ready) ---
# Examples (commented until configured):
#   vercel deploy            # preview/DEV deploy (NEVER --prod)
#   docker compose -f docker-compose.dev.yml up -d --build
echo "[deploy] DEV build complete. (Wire your DEV target here — preview deploy / docker compose dev.)"
echo "[deploy] OK (env=dev)"
