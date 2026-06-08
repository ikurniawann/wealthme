#!/usr/bin/env bash
# Security gate: scan for hardcoded secrets, committed env files, destructive code,
# and dependency advisories. Exit non-zero on any blocking finding.
set -uo pipefail
cd "$(dirname "$0")/.."
fail=0
note() { echo "[security] $1"; }
bad()  { echo "[security][BLOCK] $1"; fail=1; }

# Determine scan scope: changed files vs base branch if possible, else tracked files.
if git rev-parse --git-dir >/dev/null 2>&1; then
  base="$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD origin/development 2>/dev/null || true)"
  if [ -n "$base" ]; then
    mapfile -t files < <( { git diff --name-only "$base"...HEAD; git diff --name-only; git ls-files --others --exclude-standard; } | sort -u )
  else
    mapfile -t files < <(git ls-files)
  fi
else
  mapfile -t files < <(find . -path ./node_modules -prune -o -type f -print)
fi

src=()
for f in "${files[@]:-}"; do
  [ -f "$f" ] || continue
  case "$f" in
    *node_modules/*|*/.next/*|*/dist/*|*.lock|pnpm-lock.yaml|scripts/security-check.sh|*.png|*.jpg|*.jpeg|*.svg|*.ico) continue;;
  esac
  src+=("$f")
done
[ "${#src[@]}" -eq 0 ] && { note "no files to scan"; exit 0; }
note "scanning ${#src[@]} file(s)..."

# --- 1. Hardcoded secrets ---
patterns=(
  'AKIA[0-9A-Z]{16}'
  '-----BEGIN[A-Z ]*PRIVATE KEY-----'
  '(secret|password|passwd|api[_-]?key|token)["'"'"' ]*[:=]["'"'"' ]*[A-Za-z0-9_\-]{16,}'
  'sk-[A-Za-z0-9]{20,}'
  'gh[pousr]_[A-Za-z0-9]{20,}'
  'xox[baprs]-[A-Za-z0-9-]{10,}'
  'AIza[0-9A-Za-z_\-]{30,}'
)
allow='(\.env\.example|example|PLACEHOLDER|<your|process\.env|import\.meta\.env|REDACTED)'
for p in "${patterns[@]}"; do
  if grep -REnI "$p" "${src[@]}" 2>/dev/null | grep -vE "$allow"; then
    bad "possible hardcoded secret matching /$p/"
  fi
done

# --- 2. Committed real env files (allow .env.example) ---
for f in "${src[@]}"; do
  case "$f" in */.env|.env|*/.env.local|.env.local|*/.env.production|.env.production) bad "env file committed: $f";; esac
done

# --- 3. Destructive DB statements in source (blocking) ---
DDL="DR""OP"  # split literal to avoid tooling self-trigger
if grep -REnIi "${DDL} +(DATABASE|SCHEMA|TABLE)|TRUNCATE +TABLE" "${src[@]}" 2>/dev/null; then
  bad "destructive DB statement present in source"
fi

# --- 4. Dynamic-exec patterns (informational) ---
if grep -REnI 'child_process|new Function\(' "${src[@]}" 2>/dev/null | grep -vE '(test|spec|\.md$)'; then
  note "dynamic-exec patterns found above — review manually"
fi

# --- 5. Dependency advisories (high/critical block) ---
if command -v corepack >/dev/null 2>&1; then
  if corepack pnpm audit --prod --audit-level high >/tmp/wm_audit.txt 2>&1; then
    note "pnpm audit: no high/critical advisories"
  else
    note "pnpm audit reported high/critical advisories:"; tail -20 /tmp/wm_audit.txt; fail=1
  fi
fi

if [ "$fail" -ne 0 ]; then echo "[security] FAILED"; exit 1; fi
echo "[security] OK"
