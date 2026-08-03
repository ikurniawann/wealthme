-- EPIC-021 Group E (#16, #17, #18, #20): asset depreciation/appreciation
-- rate, physical-asset master-data category, and investment interest rate.
-- Fully additive — all new columns are nullable, no backfill required, no
-- drops.

-- AlterTable: Asset gains a signed annual value-change rate (negative =
-- depreciation, positive = appreciation) and an optional link to the
-- existing Category master-data model.
ALTER TABLE "assets" ADD COLUMN "valueChangeRatePct" DECIMAL(5,2);
ALTER TABLE "assets" ADD COLUMN "categoryId" TEXT;

CREATE INDEX "assets_categoryId_idx" ON "assets"("categoryId");

ALTER TABLE "assets"
  ADD CONSTRAINT "assets_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "categories"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Investment gains an optional interest rate for interest-bearing
-- instruments (obligasi/deposito), used for a projected-annual-yield display.
ALTER TABLE "investments" ADD COLUMN "interestRatePct" DECIMAL(5,2);
