#!/usr/bin/env bash
# Runs the SkillSpector scanner (bundled inside this skill) and writes a JSON
# report. Self-contained: ensures the scanner is installed on first run.
#
# Usage:   scan.sh <skill-path-or-github-url> [out.json]
# Output:  prints the path to the JSON report on the last line.
#
# Env:
#   SKILLSPECTOR_LLM   "1" = full LLM pass via your Claude Code session
#                      (no API key). Default "0" = fast static-only.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
VENV="$SKILL_DIR/vendor/skillspector/.venv"

TARGET="${1:?usage: scan.sh <skill-path-or-url> [out.json]}"
OUT="${2:-/tmp/skillspector-scan.json}"

# Make sure the scanner is installed (clones + patches + builds on first run).
"$SCRIPT_DIR/bootstrap.sh" || exit $?

# shellcheck disable=SC1091
source "$VENV/bin/activate"

if [ "${SKILLSPECTOR_LLM:-0}" = "1" ]; then
  # Use the local Claude Code session as the LLM brain — no API key.
  unset ANTHROPIC_API_KEY OPENAI_API_KEY NVIDIA_INFERENCE_KEY
  export SKILLSPECTOR_USE_CLAUDE_CLI=1
  skillspector scan "$TARGET" --format json -o "$OUT" >/dev/null
else
  skillspector scan "$TARGET" --no-llm --format json -o "$OUT" >/dev/null
fi

# skillspector exits 1 when risk_score > 50 (a CI gate, not an error) and 2 on a
# real failure. The report is written either way; only a real failure should
# fail the helper.
rc=$?
if [ "$rc" -ge 2 ]; then
  echo "skillspector failed (exit $rc)" >&2
  exit "$rc"
fi

echo "$OUT"
