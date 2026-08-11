-- EPIC-024 A1/A3 (D1, Evidence #1) — corrective backfill, not a schema
-- change. NOT to be applied automatically by this task; the epic's autonomy
-- rules require an explicit human announcement before this migration is
-- run against any real database, because it changes a real family's access
-- (a member's `role`).
--
-- STAGING LOCATION — READ BEFORE USE
-- This file deliberately lives OUTSIDE `apps/api/prisma/migrations/` (under
-- `docs/migrations/`) so `prisma migrate deploy` — run unconditionally by
-- `scripts/deploy-dev.sh` and any CI/CD migrate step — NEVER picks it up.
-- A comment alone is not a gate; only living outside the migrations
-- directory is. To actually apply this backfill, a human must, AFTER the
-- required epic announcement:
--   1. Create a new timestamped folder:
--      apps/api/prisma/migrations/<YYYYMMDDHHMMSS>_epic024_a3_istri_owner_backfill/
--   2. Copy this file's SQL body into `migration.sql` inside that folder.
--   3. Run `prisma migrate deploy` (or `prisma migrate resolve` as
--      appropriate for the target environment) explicitly, with the
--      announcement already made and DB backup confirmed.
-- Do not move or copy this file back into `apps/api/prisma/migrations/`
-- as part of any automated task/loop.
--
-- Before this epic, a wife (`Member.relationship = 'istri'`) was invited
-- like any other member and typically carried `role = 'spouse'`
-- (EPIC-023 D2/D6's now-superseded default). EPIC-024 D1 makes her a true
-- second OWNER of her husband's family group instead — this backfill
-- upgrades any EXISTING istri row's role to 'owner' so a wife added before
-- this epic gets the same full powers a newly-created one gets via
-- `FamilyGroupsService#createDependantMember` (A1).
--
-- Deliberately NARROW and SAFE:
--  * Only touches rows where relationship = 'istri' — no other kinship or
--    role is affected.
--  * Only promotes a family group with EXACTLY ONE istri row. A family
--    group with more than one 'istri' row (should not exist under the new
--    max-1 constraint, but predates its enforcement) is left completely
--    untouched — resolving which one is "the" co-master is a judgment
--    call for a human, not a migration. Flagged here rather than silently
--    picking one, matching this epic's "flag it, don't silently add
--    unspecified behavior" convention (see EPIC-024 Group L's storage-quota
--    note for the same pattern).
--  * Never deletes or modifies a FamilyGroup row — an istri's own,
--    separately auto-created family group (from her own earlier
--    self-registration, if any) is left exactly as-is, per D1 ("her empty
--    auto-created group is left alone (no deletion)"). Known residual gap:
--    if that self-registered group is OLDER than her husband's group
--    (the common case — she registered before being added), the
--    `createdAt: asc` group-resolution rule unified in this same task (A3)
--    will still resolve her ACTIVE group to her own empty one, not her
--    husband's. Closing that gap requires either deleting her empty group
--    or reordering membership timestamps, neither of which this backfill
--    does without an explicit human decision — flagged for the epic
--    owner, not silently resolved here.
--  * Idempotent: re-running finds nothing left to update (role is already
--    'owner') and is a no-op.
--  * Additive/reversible: only writes `role`; the previous value is
--    recoverable from any point-in-time backup/WAL if this ever needs to
--    be undone.
-- NOTE: raw table name is "members" — the `@@map`'d Postgres table for the
-- `Member` Prisma model (schema.prisma), not the Prisma model name itself.
UPDATE "members" AS m
SET "role" = 'owner'
WHERE m."relationship" = 'istri'
  AND m."role" <> 'owner'
  AND (
    SELECT COUNT(*)
    FROM "members" AS m2
    WHERE m2."familyGroupId" = m."familyGroupId"
      AND m2."relationship" = 'istri'
  ) = 1;
