#!/usr/bin/env bash
# Test gate: install, type-check via build, and run tests across the monorepo.
set -euo pipefail
cd "$(dirname "$0")/.."

# Invoke pnpm directly (matching CI), NOT `corepack pnpm`: under a `corepack pnpm`
# parent, the child pnpm processes that turbo spawns refuse to version-switch and
# error when the ambient pnpm differs from the pinned `packageManager`. Provision
# via corepack if available, then call `pnpm` directly so it can switch versions.
command -v corepack >/dev/null 2>&1 && corepack enable >/dev/null 2>&1 || true
PNPM="pnpm"
echo "[test] installing dependencies..."
$PNPM install --frozen-lockfile 2>/dev/null || $PNPM install

echo "[test] building all workspaces (type-checks included)..."
$PNPM turbo run build

# Run tests only for packages that define a "test" script (avoids turbo 'no tasks' error).
if grep -rslE '"test"[[:space:]]*:' apps packages --include=package.json | grep -qv 'echo'; then
  echo "[test] running tests..."
  $PNPM turbo run test
else
  echo "[test] no real test scripts found yet — skipping (build passed)."
fi
echo "[test] OK"
