#!/usr/bin/env bash
# Rounds per feature, from results.tsv. The before/after number.
# Usage from repository root: bash .claude/loop-kit/stats.sh
if [[ ! -f results.tsv ]]; then
  printf 'No loop results yet.\n'
  exit 0
fi
awk -F'\t' 'NR>1 && $2>0 { r[$1]++; if ($4=="reverted") u[$1]++; last[$1]=$4 }
  END { for (f in r) printf "%-24s %2d rounds  %2d reverted  %s\n", f, r[f], u[f], last[f] }' results.tsv
