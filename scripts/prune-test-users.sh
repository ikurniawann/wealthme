#!/usr/bin/env bash
# Prune leftover e2e test users (and the family groups they orphan) from the
# DEV database. DEV ONLY — refuses any production target.
#
# WHY THIS EXISTS
# ---------------
# Several e2e specs register a brand-new account through the app on every run:
#
#   apps/web/tests/e2e/pages/epic-015-new-user-session.spec.ts   qa-bugfix-<ts>@example.com
#   apps/web/tests/e2e/pages/epic-015-204-delete-refresh.spec.ts qa-204fix-<ts>@example.com
#   apps/web/tests/e2e/pages/epic-015-investasi-edit-liability.spec.ts
#                                                                qa-verify2-<ts>@example.com
#   apps/web/tests/e2e/pages/epic-016-task-a-profile-persistence.spec.ts
#                                                                epic-016-profile-<ts>@example.com
#   apps/web/tests/e2e/audit/modal-geometry.spec.ts    qa-modal-geometry-fixture+<ts>-<n>@wealthme.id
#
# A fresh account is inherent to what those specs test (a *new* user's first
# session), so they cannot simply reuse one fixture. There is deliberately no
# "delete user" API — adding one purely for tests would be a real security
# surface — so cleanup lives here instead, run by a human against DEV.
#
# Left unrun, every e2e pass permanently adds one user + one family group. They
# accumulate silently and then show up in the product: the "Pemilik" dropdown on
# /rekening lists every member, so stale fixtures become selectable owners there.
# (Observed 2026-08-04: 19 leftover fixtures against 1 real account.)
#
# SAFETY
# ------
# - Dry run by default. Deletes only with --yes.
# - Matches ONLY the fixture email patterns above; never a wildcard, never
#   "everything except X".
# - Refuses to touch a user whose family group holds any transaction, so a real
#   account that happens to match a pattern is never silently destroyed.
# - Family groups are removed only after they are left with zero members.
#
# USAGE
#   bash scripts/prune-test-users.sh          # dry run: report what would go
#   bash scripts/prune-test-users.sh --yes    # actually delete
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET="${DEPLOY_ENV:-dev}"
if [[ "$TARGET" =~ ^(prod|production)$ ]]; then
  echo "[prune] REFUSED: this script never runs against production." >&2
  exit 1
fi

APPLY=0
for arg in "$@"; do
  case "$arg" in
    --yes) APPLY=1 ;;
    *) echo "[prune] unknown argument: $arg (expected --yes)" >&2; exit 1 ;;
  esac
done

PG_CONTAINER="${PG_CONTAINER:-wealthme-web-postgres-1}"
if ! docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
  echo "[prune] REFUSED: postgres container '$PG_CONTAINER' is not running." >&2
  exit 1
fi

PGUSER_VAL="$(docker exec "$PG_CONTAINER" sh -c 'echo $POSTGRES_USER')"
PGDB_VAL="$(docker exec "$PG_CONTAINER" sh -c 'echo $POSTGRES_DB')"

psql_q() {
  docker exec "$PG_CONTAINER" psql -U "$PGUSER_VAL" -d "$PGDB_VAL" -v ON_ERROR_STOP=1 "$@"
}

# The fixture email shapes, and nothing else.
PATTERN="^(qa-204fix-|qa-verify2-|qa-bugfix-|qa-owner-|epic-016-profile-|qa-modal-geometry-fixture\+)"

# A fixture whose family group holds transactions is NOT a fixture — leave it
# alone and say so, rather than quietly deleting someone's real data.
PROTECTED_COUNT="$(psql_q -tAc "
  SELECT count(DISTINCT u.id) FROM users u
  JOIN members m ON m.\"userId\" = u.id
  WHERE u.email ~ '$PATTERN'
    AND EXISTS (SELECT 1 FROM transactions t WHERE t.\"familyGroupId\" = m.\"familyGroupId\");")"

echo "[prune] candidates (fixture email patterns, no transactions):"
psql_q -c "
  SELECT u.email, u.\"createdAt\"::date AS created
  FROM users u
  WHERE u.email ~ '$PATTERN'
    AND NOT EXISTS (
      SELECT 1 FROM members m
      JOIN transactions t ON t.\"familyGroupId\" = m.\"familyGroupId\"
      WHERE m.\"userId\" = u.id)
  ORDER BY u.\"createdAt\";"

if [ "$PROTECTED_COUNT" -gt 0 ]; then
  echo "[prune] NOTE: $PROTECTED_COUNT matching user(s) own transactions and are left untouched."
fi

if [ "$APPLY" != "1" ]; then
  echo "[prune] dry run — nothing deleted. Re-run with --yes to apply."
  exit 0
fi

psql_q -c "
BEGIN;
DELETE FROM users u
 WHERE u.email ~ '$PATTERN'
   AND NOT EXISTS (
     SELECT 1 FROM members m
     JOIN transactions t ON t.\"familyGroupId\" = m.\"familyGroupId\"
     WHERE m.\"userId\" = u.id);
-- Deleting a user cascades its Member rows; any family group thereby left with
-- no members was a fixture's own group and is removed too. Groups that still
-- have members (e.g. the seeded demo family) are untouched.
DELETE FROM family_groups fg
 WHERE NOT EXISTS (SELECT 1 FROM members m WHERE m.\"familyGroupId\" = fg.id)
   AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.\"familyGroupId\" = fg.id);
COMMIT;"

echo "[prune] done. Remaining:"
psql_q -c "SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM family_groups) AS family_groups, (SELECT count(*) FROM transactions) AS transactions;"
