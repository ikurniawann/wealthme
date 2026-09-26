-- Revisi K: recordable KPR prepayments. Additive; existing rows untouched.
CREATE TYPE "PrepaymentMode" AS ENUM ('full', 'reduce_tenor', 'reduce_installment');

ALTER TABLE "liabilities" ADD COLUMN "installmentFromPeriod" INTEGER;

CREATE TABLE "liability_prepayments" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "liabilityId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "mode" "PrepaymentMode" NOT NULL,
    "principalAmount" BIGINT NOT NULL,
    "penaltyPercent" DECIMAL(5,2) NOT NULL,
    "penaltyAmount" BIGINT NOT NULL,
    "sourceAccountId" TEXT NOT NULL,
    "effectivePeriod" INTEGER NOT NULL,
    "installmentBefore" BIGINT,
    "installmentAfter" BIGINT,
    "tenorMonthsBefore" INTEGER NOT NULL,
    "tenorMonthsAfter" INTEGER NOT NULL,
    "createdByUserId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liability_prepayments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "liability_prepayments_liabilityId_idempotencyKey_key" ON "liability_prepayments"("liabilityId", "idempotencyKey");

CREATE INDEX "liability_prepayments_familyGroupId_idx" ON "liability_prepayments"("familyGroupId");

ALTER TABLE "liability_prepayments" ADD CONSTRAINT "liability_prepayments_liabilityId_fkey" FOREIGN KEY ("liabilityId") REFERENCES "liabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transactions" ADD COLUMN "liabilityPrepaymentId" TEXT;

CREATE INDEX "transactions_liabilityPrepaymentId_idx" ON "transactions"("liabilityPrepaymentId");

ALTER TABLE "transactions" ADD CONSTRAINT "transactions_liabilityPrepaymentId_fkey" FOREIGN KEY ("liabilityPrepaymentId") REFERENCES "liability_prepayments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Dedicated prepayment-penalty expense account for every existing family
-- (GENERIC_COA_CHART "20011"); same idempotent backfill as 20009/20010.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

INSERT INTO "coa_accounts"
  ("id", "familyGroupId", "code", "name", "groupNum", "direction", "budgetType", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  fg."id",
  '20011',
  'Penalti Pelunasan Pinjaman',
  2,
  'EXPENSE'::"CoaDirection",
  'VARIABLE'::"CoaBudgetType",
  now(),
  now()
FROM "family_groups" fg
ON CONFLICT ("familyGroupId", "code") DO NOTHING;
