-- EPIC-023 group E retry (backend/design fix round 2).
--
-- HIGH 3 — provision the dedicated insurance-premium expense COA account
-- (GENERIC_COA_CHART code "20010", "Premi Asuransi") for every EXISTING
-- family group that does not already have it, mirroring the A1 migration's
-- "20009 Bunga Pinjaman" backfill exactly (idempotent INSERT ... ON
-- CONFLICT DO NOTHING against the (familyGroupId, code) unique constraint).
-- `InsurancesService` no longer posts premiums against the generic "20099"
-- catch-all, which used to silently hijack a user's own "Pengeluaran
-- Lainnya" budget line.
--
-- HIGH 4 — `liabilities`/`insurances` each gain a nullable
-- `principalCategoryId`/`premiumCategoryId` FK to `categories`, so every
-- obligation can own its OWN budget-tracking category instead of every
-- obligation in a family group sharing ONE. Purely additive: nullable
-- columns, no DROP, no DELETE, no TRUNCATE. Existing rows stay NULL and are
-- self-healed (backfilled) the next time `create()`/`update()`/`pay()` is
-- called for that obligation — see LiabilitiesService/InsurancesService.
-- Pre-existing SHARED budget lines from before this migration are not
-- retroactively split (out of scope for this fix — see this task's
-- Automation Log); they remain functionally as before until the obligation
-- that seeded them is next updated or paid.

-- pgcrypto (gen_random_uuid) is already enabled by an earlier migration.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

INSERT INTO "coa_accounts"
  ("id", "familyGroupId", "code", "name", "groupNum", "direction", "budgetType", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  fg."id",
  '20010',
  'Premi Asuransi',
  2,
  'EXPENSE'::"CoaDirection",
  'FIXED'::"CoaBudgetType",
  now(),
  now()
FROM "family_groups" fg
ON CONFLICT ("familyGroupId", "code") DO NOTHING;

-- AlterTable
ALTER TABLE "liabilities" ADD COLUMN "principalCategoryId" TEXT;
ALTER TABLE "insurances" ADD COLUMN "premiumCategoryId" TEXT;

-- CreateIndex
CREATE INDEX "liabilities_principalCategoryId_idx" ON "liabilities"("principalCategoryId");
CREATE INDEX "insurances_premiumCategoryId_idx" ON "insurances"("premiumCategoryId");

-- AddForeignKey — ON DELETE SET NULL: a Category deleted through the
-- Categories API (unusual, and not the primary path this task hardens)
-- must not cascade into deleting the Liability/Insurance itself.
ALTER TABLE "liabilities"
  ADD CONSTRAINT "liabilities_principalCategoryId_fkey"
  FOREIGN KEY ("principalCategoryId") REFERENCES "categories"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "insurances"
  ADD CONSTRAINT "insurances_premiumCategoryId_fkey"
  FOREIGN KEY ("premiumCategoryId") REFERENCES "categories"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
