#!/usr/bin/env bash
# Create the WealthMe GitHub Projects (v2) kanban + labels + milestones + all
# backlog issues from scripts/backlog.json. Idempotent: safe to re-run.
#
# Prereqs:
#   - gh CLI authenticated: `gh auth login` with scopes: repo, read:org, project
#   - jq installed
#
# Usage:
#   bash scripts/setup-github-project.sh                 # use current repo
#   bash scripts/setup-github-project.sh --rename wealthme   # also rename repo
#   REPO=owner/name bash scripts/setup-github-project.sh # explicit repo
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKLOG="$ROOT/scripts/backlog.json"
RENAME=""
[ "${1:-}" = "--rename" ] && RENAME="${2:-}"

command -v gh >/dev/null || { echo "✗ gh not found"; exit 1; }
command -v jq >/dev/null || { echo "✗ jq not found"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "✗ Run: gh auth login (scopes: repo, read:org, project)"; exit 1; }

OWNER="$(jq -r .owner "$BACKLOG")"
[ -n "$OWNER" ] && [ "$OWNER" != "null" ] || OWNER="$(gh api user --jq .login)"

# Resolve repo (explicit env > backlog repo if exists > current dir remote)
if [ -n "${REPO:-}" ]; then
  REPO_FULL="$REPO"
else
  CUR="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)"
  REPO_FULL="${CUR:-$OWNER/$(jq -r .repo "$BACKLOG")}"
fi

if [ -n "$RENAME" ]; then
  echo "▶ Renaming repo $REPO_FULL → $OWNER/$RENAME"
  gh repo rename "$RENAME" -R "$REPO_FULL" --yes || true
  REPO_FULL="$OWNER/$RENAME"
fi
echo "▶ Owner=$OWNER  Repo=$REPO_FULL"

PROJECT_TITLE="$(jq -r .project "$BACKLOG")"

# ── 1. Labels ────────────────────────────────────────────────────────────────
echo "▶ Labels"
mklabel() { gh label create "$1" -R "$REPO_FULL" --color "$2" --description "$3" --force >/dev/null; }
mklabel "area:frontend" "1f6feb" "Frontend (Next.js)"
mklabel "area:backend"  "8957e5" "Backend (NestJS)"
mklabel "area:infra"    "6e7681" "Infra / DevOps"
mklabel "type:feature"     "0e8a16" "Feature work"
mklabel "type:chore"       "fbca04" "Chore / tooling"
mklabel "type:integration" "d93f0b" "External integration"
mklabel "prio:P0" "b60205" "Must-have for MVP"
mklabel "prio:P1" "d93f0b" "Core product"
mklabel "prio:P2" "fbca04" "Follow-up / advanced"
for p in 0 1 2 3 4 5 6 7; do mklabel "phase:$p" "ededed" "Roadmap phase $p"; done

# ── 2. Milestones (idempotent) ───────────────────────────────────────────────
echo "▶ Milestones"
existing_ms="$(gh api "repos/$REPO_FULL/milestones?state=all&per_page=100" --jq '.[].title' 2>/dev/null || true)"
declare -A MS_TITLE
while IFS= read -r row; do
  ph="$(jq -r .phase <<<"$row")"; title="$(jq -r .title <<<"$row")"
  MS_TITLE[$ph]="$title"
  if ! grep -qxF "$title" <<<"$existing_ms"; then
    gh api "repos/$REPO_FULL/milestones" -f title="$title" -f description="WealthMe roadmap phase $ph" >/dev/null \
      && echo "  + $title" || echo "  (skip) $title"
  fi
done < <(jq -c '.milestones[]' "$BACKLOG")

# ── 3. Project (find or create) ──────────────────────────────────────────────
echo "▶ Project '$PROJECT_TITLE'"
PNUM="$(gh project list --owner "$OWNER" --format json --jq ".projects[] | select(.title==\"$PROJECT_TITLE\") | .number" 2>/dev/null | head -1 || true)"
if [ -z "$PNUM" ]; then
  PNUM="$(gh project create --owner "$OWNER" --title "$PROJECT_TITLE" --format json --jq .number)"
  echo "  created project #$PNUM"
else
  echo "  using existing project #$PNUM"
fi
PID="$(gh project view "$PNUM" --owner "$OWNER" --format json --jq .id)"

# ── 4. Fields (single-select: Area, Priority, Phase) ─────────────────────────
echo "▶ Fields"
ensure_field() { # name, options(csv)
  local name="$1" opts="$2"
  if ! gh project field-list "$PNUM" --owner "$OWNER" --format json --jq '.fields[].name' | grep -qxF "$name"; then
    gh project field-create "$PNUM" --owner "$OWNER" --name "$name" \
      --data-type SINGLE_SELECT --single-select-options "$opts" >/dev/null && echo "  + $name"
  fi
}
ensure_field "Area"     "Frontend,Backend,Infra"
ensure_field "Priority" "P0,P1,P2"
ensure_field "Phase"    "Phase 0,Phase 1,Phase 2,Phase 3,Phase 4,Phase 5,Phase 6,Phase 7"

FIELDS_JSON="$(gh project field-list "$PNUM" --owner "$OWNER" --format json)"
fid()  { jq -r --arg n "$1" '.fields[] | select(.name==$n) | .id' <<<"$FIELDS_JSON"; }
oid()  { jq -r --arg n "$1" --arg o "$2" '.fields[] | select(.name==$n) | .options[]? | select(.name==$o) | .id' <<<"$FIELDS_JSON"; }
AREA_F="$(fid Area)"; PRIO_F="$(fid Priority)"; PHASE_F="$(fid Phase)"; STATUS_F="$(fid Status)"
STATUS_TODO="$(oid Status Todo)"

# ── 5. Issues ────────────────────────────────────────────────────────────────
echo "▶ Issues"
n=0
while IFS= read -r row; do
  title="$(jq -r .title <<<"$row")"
  body="$(jq -r .body <<<"$row")"
  area="$(jq -r .area <<<"$row")"
  prio="$(jq -r .priority <<<"$row")"
  phase="$(jq -r .phase <<<"$row")"
  alabel="area:$(echo "$area" | tr '[:upper:]' '[:lower:]')"
  tlabel="type:feature"; [ "$area" = "Infra" ] && tlabel="type:chore"; [ "$phase" -ge 6 ] && [ "$area" = "Backend" ] && tlabel="type:integration"
  ms="${MS_TITLE[$phase]}"

  # skip if an open/closed issue with the exact title already exists
  exists="$(gh issue list -R "$REPO_FULL" --state all --search "$title in:title" --json title --jq "[.[]|select(.title==\"$title\")]|length" 2>/dev/null || echo 0)"
  if [ "${exists:-0}" -gt 0 ]; then echo "  (exists) $title"; continue; fi

  url="$(gh issue create -R "$REPO_FULL" --title "$title" --body "$body" \
        --label "$alabel" --label "$tlabel" --label "prio:$prio" --label "phase:$phase" \
        --milestone "$ms")"
  echo "  + [$area/$prio/P$phase] $title"

  item="$(gh project item-add "$PNUM" --owner "$OWNER" --url "$url" --format json --jq .id)"
  setf() { [ -n "$2" ] && [ -n "$3" ] && gh project item-edit --project-id "$PID" --id "$1" --field-id "$2" --single-select-option-id "$3" >/dev/null || true; }
  setf "$item" "$AREA_F"  "$(oid Area "$area")"
  setf "$item" "$PRIO_F"  "$(oid Priority "$prio")"
  setf "$item" "$PHASE_F" "$(oid Phase "Phase $phase")"
  setf "$item" "$STATUS_F" "$STATUS_TODO"
  n=$((n+1))
done < <(jq -c '.epics[] as $e | $e.issues[] | {title,body,area,priority,phase:$e.phase}' "$BACKLOG")

echo "✅ Done. Created $n new issue(s)."
echo "   Board: $(gh project view "$PNUM" --owner "$OWNER" --format json --jq .url 2>/dev/null)"
