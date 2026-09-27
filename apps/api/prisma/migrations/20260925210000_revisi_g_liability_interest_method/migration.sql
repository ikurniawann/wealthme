-- Revisi G (catalog item 12): per-product interest method, tenor, installment and KPR fixed/floating terms.
CREATE TYPE "InterestMethod" AS ENUM ('efektif', 'flat', 'anuitas');

ALTER TABLE "liabilities"
  ADD COLUMN "interestMethod" "InterestMethod" NOT NULL DEFAULT 'efektif',
  ADD COLUMN "tenorMonths" INTEGER,
  ADD COLUMN "startDate" TIMESTAMP(3),
  ADD COLUMN "installmentAmount" BIGINT,
  ADD COLUMN "fixedRateMonths" INTEGER,
  ADD COLUMN "floatingRate" DECIMAL(5,2);
