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
#
# DEPLOY_MODE (default "pull"): pull prebuilt api/web images from GHCR — see
# .github/workflows/ci.yml's build-and-push-images job — instead of building
# locally. This is the default because local builds on this host became
# unreliable (apt-get/pnpm install/next build failing on randomly different
# packages each run — a hardware symptom, not a code or Docker bug; see
# docs/DEPLOYMENT.md). Set DEPLOY_MODE=build to fall back to the old
# build-locally path (e.g. before the first CI image exists, or if GHCR is
# unreachable). Pulling requires `docker login ghcr.io` to have been run once
# on this host already if the images are private — see docs/DEPLOYMENT.md.
set -euo pipefail
cd "$(dirname "$0")/.."

DEPLOY_MODE="${DEPLOY_MODE:-pull}"
if [ "$DEPLOY_MODE" != "pull" ] && [ "$DEPLOY_MODE" != "build" ]; then
  echo "[deploy] REFUSED: DEPLOY_MODE must be 'pull' or 'build', got '$DEPLOY_MODE'." >&2
  exit 1
fi

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
  docker compose -f docker-compose.yml down -v
fi

# -f docker-compose.yml explicitly excludes docker-compose.override.yml.
# That override file forces browser-facing origins (BETTER_AUTH_URL,
# WEB_ORIGIN, and the NEXT_PUBLIC_* build args baked into the client bundle)
# to localhost for a developer's own laptop. This script runs ON the shared
# dev server (public domain from .env, e.g. wealthme.demo-wit.id via tunnel)
# — plain `docker compose up` silently picks up the override, breaking CORS
# and baking the wrong origin into the built JS.
if [ "$DEPLOY_MODE" = "pull" ]; then
  echo "[deploy] target=DEV, mode=pull — fetching prebuilt images (tag: ${DEPLOY_IMAGE_TAG:-dev})..."
  if ! docker compose -f docker-compose.yml pull; then
    echo "[deploy] REFUSED: image pull failed. If ghcr.io/andrsrjld/wealthme-web-{api,web} is private, run 'docker login ghcr.io' once on this host first (see docs/DEPLOYMENT.md). Falling back to DEPLOY_MODE=build is also an option for this run only." >&2
    exit 1
  fi
  # starts infra, runs the one-shot migrate service (migrate deploy + seed)
  # against the pulled image, then starts api + web. --wait blocks until
  # healthy / migrate completes. No --build: uses the image just pulled.
  docker compose -f docker-compose.yml up -d --wait
else
  echo "[deploy] target=DEV, mode=build — building images locally and bringing up the stack..."
  # Compose builds the api/web images, starts infra, runs the one-shot
  # migrate service (migrate deploy + seed), then starts api + web. --wait
  # blocks until healthy / migrate completes.
  docker compose -f docker-compose.yml up -d --build --wait
fi

echo "[deploy] stack up. Health check:"
curl -fsS http://localhost:4000/health >/dev/null 2>&1 && echo "[deploy]   api  :4000 OK" || echo "[deploy]   api  :4000 not ready yet"
echo "[deploy] OK (env=dev) — web :3000, api :4000, seeded demo@wealthme.id"
