#!/usr/bin/env bash
# Ensures the SkillSpector scanner is installed *inside this skill* and patched
# for the no-API-key Claude Code LLM pass. Idempotent and move-safe: it checks
# the venv actually runs, and rebuilds it if the skill folder was moved/renamed
# (a Python venv hardcodes its own path, so a move breaks it). Run automatically
# by scan.sh; safe to run by hand.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
VENDOR="$SKILL_DIR/vendor/skillspector"
VENV="$VENDOR/.venv"

REPO_URL="https://github.com/NVIDIA/skillspector.git"
PIN_COMMIT="cff7ecc4f2881d9e23ea4bb801a6353e1dbe39e6"

# Already working? (the binary must actually run, not just exist — a moved venv
# still has the file but its hardcoded paths are broken)
if "$VENV/bin/skillspector" --version >/dev/null 2>&1; then
  exit 0
fi

echo "discover-skills: setting up the scanner…" >&2
command -v git >/dev/null || { echo "git is required" >&2; exit 3; }

# 1. Ensure the source is present (clone the pinned commit if missing)
if [ ! -e "$VENDOR/pyproject.toml" ]; then
  rm -rf "$VENDOR"
  git clone --quiet "$REPO_URL" "$VENDOR" || { echo "clone failed" >&2; exit 3; }
  git -C "$VENDOR" fetch --quiet --depth 1 origin "$PIN_COMMIT" 2>/dev/null || true
  git -C "$VENDOR" checkout --quiet "$PIN_COMMIT" 2>/dev/null || \
    echo "discover-skills: pinned commit not found, using default branch" >&2
fi

# 2. (Re)apply our patch — this is what gives the clone the claude -p backend.
cp "$SKILL_DIR/patch/claude_cli.py" "$VENDOR/src/skillspector/claude_cli.py"
cp "$SKILL_DIR/patch/llm_utils.py" "$VENDOR/src/skillspector/llm_utils.py"

# 3. (Re)build the venv. Needed on first run AND after any move/rename, since the
#    venv stores its own absolute path. uv pulls from its cache, so this is fast
#    and doesn't re-download packages.
rm -rf "$VENV"
if command -v uv >/dev/null; then
  ( cd "$VENDOR" && uv sync >/dev/null 2>&1 ) || { echo "install failed" >&2; exit 3; }
else
  python3 -m venv "$VENV" >/dev/null 2>&1
  "$VENV/bin/pip" install --quiet -e "$VENDOR" >/dev/null 2>&1 || { echo "install failed" >&2; exit 3; }
fi

"$VENV/bin/skillspector" --version >/dev/null 2>&1 && echo "discover-skills: ready" >&2
