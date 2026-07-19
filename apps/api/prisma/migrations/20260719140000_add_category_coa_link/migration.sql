-- EPIC-017 Task A+G: mandatory Category → CoaAccount link (NOT NULL).
-- Additive + self-healing: provisions a generic COA chart for any family group
-- that has none (real/registered groups; the demo group keeps its own chart),
-- backfills every category, then enforces NOT NULL + FK. No drops.

-- gen_random_uuid() lives in core on PG13+, but guarantee it for any version.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Add the column nullable so the backfill can run before NOT NULL is enforced.
ALTER TABLE "categories" ADD COLUMN "coaAccountId" TEXT;

-- 2. Provision the generic starter chart for every family group that has no COA
--    accounts yet. Keep in sync with src/common/coa/default-coa-chart.ts.
INSERT INTO "coa_accounts"
  ("id", "familyGroupId", "code", "name", "groupNum", "direction", "budgetType", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(), fg."id", c."code", c."name", c."groupNum",
  c."direction"::"CoaDirection", c."budgetType"::"CoaBudgetType", now(), now()
FROM "family_groups" fg
CROSS JOIN (VALUES
  ('10001', 'Gaji', 1, 'INCOME', 'FIXED'),
  ('10002', 'Bonus', 1, 'INCOME', 'VARIABLE'),
  ('10003', 'Pendapatan Usaha', 1, 'INCOME', 'VARIABLE'),
  ('10004', 'Hasil Investasi', 1, 'INCOME', 'VARIABLE'),
  ('10005', 'Passive Income', 1, 'INCOME', 'VARIABLE'),
  ('10099', 'Pemasukan Lainnya', 1, 'INCOME', 'VARIABLE'),
  ('20001', 'Makanan & Minuman', 2, 'EXPENSE', 'VARIABLE'),
  ('20002', 'Transportasi', 2, 'EXPENSE', 'VARIABLE'),
  ('20003', 'Belanja', 2, 'EXPENSE', 'VARIABLE'),
  ('20004', 'Tagihan & Utilitas', 2, 'EXPENSE', 'FIXED'),
  ('20005', 'Kesehatan', 2, 'EXPENSE', 'VARIABLE'),
  ('20006', 'Hiburan', 2, 'EXPENSE', 'VARIABLE'),
  ('20007', 'Pendidikan', 2, 'EXPENSE', 'FIXED'),
  ('20008', 'Rumah Tangga', 2, 'EXPENSE', 'VARIABLE'),
  ('20099', 'Pengeluaran Lainnya', 2, 'EXPENSE', 'VARIABLE'),
  ('30001', 'Tabungan', 3, 'TRANSFER', 'FIXED'),
  ('30002', 'Investasi', 3, 'TRANSFER', 'FIXED'),
  ('30003', 'Dana Darurat', 3, 'TRANSFER', 'FIXED'),
  ('30099', 'Alokasi Lainnya', 3, 'TRANSFER', 'VARIABLE'),
  ('40001', 'Piutang', 4, 'INCOME', 'VARIABLE'),
  ('50001', 'Utang', 5, 'EXPENSE', 'FIXED'),
  ('50002', 'Cicilan', 5, 'EXPENSE', 'FIXED'),
  ('60001', 'Pajak Penghasilan', 6, 'EXPENSE', 'FIXED'),
  ('60002', 'Pajak Lainnya', 6, 'EXPENSE', 'FIXED')
) AS c("code", "name", "groupNum", "direction", "budgetType")
WHERE NOT EXISTS (
  SELECT 1 FROM "coa_accounts" ca WHERE ca."familyGroupId" = fg."id"
);

-- 3. Backfill: point each category at a same-group COA account whose direction
--    matches its kind, preferring a "*99" catch-all bucket. Robust to any chart.
UPDATE "categories" cat
SET "coaAccountId" = (
  SELECT ca."id" FROM "coa_accounts" ca
  WHERE ca."familyGroupId" = cat."familyGroupId"
    AND ca."direction" = (CASE WHEN cat."kind" = 'income'
                               THEN 'INCOME'::"CoaDirection"
                               ELSE 'EXPENSE'::"CoaDirection" END)
  ORDER BY (CASE WHEN ca."code" LIKE '%99' THEN 0 ELSE 1 END), ca."code" ASC
  LIMIT 1
)
WHERE cat."coaAccountId" IS NULL;

-- 3b. Safety net: if a category's direction has no matching account (hand-built
--     chart), fall back to any COA account in the same family group.
UPDATE "categories" cat
SET "coaAccountId" = (
  SELECT ca."id" FROM "coa_accounts" ca
  WHERE ca."familyGroupId" = cat."familyGroupId"
  ORDER BY ca."code" ASC
  LIMIT 1
)
WHERE cat."coaAccountId" IS NULL;

-- 4. Enforce NOT NULL + FK + index.
ALTER TABLE "categories" ALTER COLUMN "coaAccountId" SET NOT NULL;

ALTER TABLE "categories"
  ADD CONSTRAINT "categories_coaAccountId_fkey"
  FOREIGN KEY ("coaAccountId") REFERENCES "coa_accounts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "categories_coaAccountId_idx" ON "categories"("coaAccountId");
