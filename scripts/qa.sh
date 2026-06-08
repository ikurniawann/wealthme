#!/usr/bin/env bash
# QA gate: lint + static checks across the monorepo.
set -euo pipefail
cd "$(dirname "$0")/.."

PNPM="corepack pnpm"
echo "[qa] installing dependencies..."
$PNPM install --frozen-lockfile 2>/dev/null || $PNPM install

echo "[qa] linting..."
$PNPM turbo run lint
echo "[qa] OK"
