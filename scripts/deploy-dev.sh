#!/usr/bin/env bash
# Backend DEV deploy ONLY. Refuses any production target.
#
# Scope: this script deploys the BACKEND (apps/api) + infra to DEV. The web
# frontend (apps/web) deploys automatically via Vercel's Git integration
# (see docs/DEPLOYMENT.md) and is intentionally NOT handled here.
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

# --- Backend DEV deploy step (wire up when the API host is chosen; EPIC-001+) ---
# Examples (commented until configured) — backend only, NEVER production:
#   docker compose -f docker-compose.dev.yml up -d --build   # self-hosted DEV
#   railway up --environment dev                             # Railway DEV
#   flyctl deploy --config fly.dev.toml                      # Fly.io DEV
# NOTE: the web frontend is NOT deployed here — Vercel Git integration handles it.
echo "[deploy] DEV build complete. (Wire the backend DEV target here — see docs/DEPLOYMENT.md.)"
echo "[deploy] OK (env=dev)"
