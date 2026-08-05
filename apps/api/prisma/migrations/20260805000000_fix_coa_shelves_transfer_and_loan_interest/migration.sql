-- EPIC-023 Task A1: correct the Chart of Accounts shelving bug for every
-- EXISTING family group. Groups 4 (Account Receivable) and 5 (Account
-- Payable) are internal balance-sheet movements (a claim owed to/by the
-- family), not real revenue/expense: a loan disbursement was wrongly
-- counted as P&L income and a principal repayment was wrongly counted as a
-- P&L expense. Decision D23 says fix the chart, not the reports engine
-- (reports.service classifies transitively via Transaction -> Category ->
-- CoaAccount.direction, unchanged by this migration).
--
-- Additive + non-destructive: no DROP, no DELETE, no TRUNCATE. Every write
-- below is either an UPDATE narrowly scoped to the mis-shelved rows or an
-- idempotent INSERT guarded by the existing @@unique([familyGroupId, code]).

-- pgcrypto (gen_random_uuid) is already enabled by an earlier migration
-- (20260719140000_add_category_coa_link), but guarantee it defensively.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Reclassify every existing group-4/group-5 COA account to TRANSFER.
--    Scoped with "direction" <> 'TRANSFER' so this is a no-op (and safely
--    re-runnable) once applied.
UPDATE "coa_accounts"
SET "direction" = 'TRANSFER', "updatedAt" = now()
WHERE "groupNum" IN (4, 5)
  AND "direction" <> 'TRANSFER';

-- 2. Provision the new loan-interest expense category (GENERIC_COA_CHART
--    code 20009, "Bunga Pinjaman" — see default-coa-chart.ts) for every
--    existing family group that does not already have it. ON CONFLICT DO
--    NOTHING makes this idempotent against the (familyGroupId, code)
--    unique constraint.
INSERT INTO "coa_accounts"
  ("id", "familyGroupId", "code", "name", "groupNum", "direction", "budgetType", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  fg."id",
  '20009',
  'Bunga Pinjaman',
  2,
  'EXPENSE'::"CoaDirection",
  'FIXED'::"CoaBudgetType",
  now(),
  now()
FROM "family_groups" fg
ON CONFLICT ("familyGroupId", "code") DO NOTHING;
