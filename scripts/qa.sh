#!/usr/bin/env bash
# QA gate: lint + static checks across the monorepo.
set -euo pipefail
cd "$(dirname "$0")/.."

# Invoke pnpm directly (matching CI), NOT `corepack pnpm`: under a `corepack pnpm`
# parent, the child pnpm processes that turbo spawns refuse to version-switch and
# error when the ambient pnpm differs from the pinned `packageManager`. Provision
# via corepack if available, then call `pnpm` directly so it can switch versions.
command -v corepack >/dev/null 2>&1 && corepack enable >/dev/null 2>&1 || true
PNPM="pnpm"
echo "[qa] installing dependencies..."
$PNPM install --frozen-lockfile 2>/dev/null || $PNPM install

echo "[qa] linting..."
$PNPM turbo run lint
echo "[qa] OK"
