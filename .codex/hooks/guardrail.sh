#!/usr/bin/env bash
# PreToolUse guardrail for Bash. Reads the tool-call JSON on stdin and blocks
# dangerous commands (exit 2 = block + feed reason back to the model).
# Bypass for an explicit, reviewed action: prefix the command with WEALTHME_OVERRIDE=1.
set -euo pipefail
input="$(cat)"
cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null || true)"
[ -z "$cmd" ] && exit 0
case "$cmd" in *WEALTHME_OVERRIDE=1*) exit 0;; esac

block() { echo "GUARDRAIL BLOCKED: $1" >&2; echo "If intentional and reviewed, re-run prefixed with WEALTHME_OVERRIDE=1" >&2; exit 2; }

# force push
printf '%s' "$cmd" | grep -Eiq 'git[[:space:]]+push[[:space:]].*(--force([^-]|$)|-f([[:space:]]|$)|--force-with-lease)' && block "force push is not allowed"
# production deploy
printf '%s' "$cmd" | grep -Eiq '(--prod\b|--production\b|deploy[-_]?prod|NODE_ENV=production[[:space:]]+.*(deploy|publish))' && block "production deploy is not allowed (DEV only)"
# destructive database
printf '%s' "$cmd" | grep -Eiq '(DROP[[:space:]]+(DATABASE|SCHEMA|TABLE)|TRUNCATE[[:space:]]+TABLE|prisma[[:space:]]+migrate[[:space:]]+reset[[:space:]]+--force)' && block "destructive database command"
# recursive force-remove of dangerous paths
printf '%s' "$cmd" | grep -Eiq 'rm[[:space:]]+-[a-zA-Z]*[rf][a-zA-Z]*[[:space:]]+(/|~|\$HOME|\.\.|\*)([[:space:]]|$)' && block "recursive force-remove of a dangerous path"
# CI/CD deploy-target edits
printf '%s' "$cmd" | grep -Eiq '(sed|tee|>).*\.github/workflows/.*deploy' && block "modifying CI/CD deploy target requires review"

exit 0
