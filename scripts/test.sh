#!/usr/bin/env bash
# Test gate: install, type-check via build, and run tests across the monorepo.
set -euo pipefail
cd "$(dirname "$0")/.."

PNPM="corepack pnpm"
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
