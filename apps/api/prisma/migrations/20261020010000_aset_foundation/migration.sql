-- Aset rebuild foundation (rulings A3, A4, A5). Additive only: new enum
-- types, new nullable/defaulted columns, one new table. No existing value,
-- timestamp or unit is rewritten; legacy quantities, costs, owners and
-- Investasi links stay unknown (NULL) — nothing is guessed from currentValue
-- and nothing is linked by name.
--
-- All enums below are NEW types (CREATE TYPE), not ALTER TYPE ... ADD VALUE,
-- so they are safe to use inside this same migration.

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('active', 'sold', 'archived');

-- CreateEnum
CREATE TYPE "AssetValuationModel" AS ENUM ('per_unit', 'total');

-- CreateEnum
CREATE TYPE "AssetHistoryKind" AS ENUM ('opening', 'valuation', 'correction', 'buy', 'sell', 'quantity_change');

-- CreateEnum
CREATE TYPE "AssetTransactionKind" AS ENUM ('opening', 'buy', 'sell');

-- CreateEnum
CREATE TYPE "AssetEventStatus" AS ENUM ('active', 'void');

-- AlterTable — every existing asset becomes status 'active' and valuation
-- model 'total' (one recorded value for the whole asset) via the column
-- defaults; all other new columns stay NULL.
ALTER TABLE "assets" ADD COLUMN     "costBasisPerUnit" DECIMAL(24,8),
ADD COLUMN     "custodian" VARCHAR(200),
ADD COLUMN     "internalCode" VARCHAR(64),
ADD COLUMN     "investmentId" TEXT,
ADD COLUMN     "ownerUserId" TEXT,
ADD COLUMN     "quantity" DECIMAL(24,8),
ADD COLUMN     "soldAt" TIMESTAMP(3),
ADD COLUMN     "status" "AssetStatus" NOT NULL DEFAULT 'active',
ADD COLUMN     "unit" VARCHAR(64),
ADD COLUMN     "valuationModel" "AssetValuationModel" NOT NULL DEFAULT 'total';

-- AlterTable — effectiveAt / effectiveDate / createdAt / source are added
-- nullable, backfilled below, then tightened, so existing rows never violate
-- the constraint and the defaults never stamp legacy rows with "now".
ALTER TABLE "asset_history" ADD COLUMN     "assetTransactionId" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3),
ADD COLUMN     "currency" VARCHAR(10) NOT NULL DEFAULT 'IDR',
ADD COLUMN     "effectiveAt" TIMESTAMP(3),
ADD COLUMN     "effectiveDate" DATE,
ADD COLUMN     "fxRate" DECIMAL(24,8),
ADD COLUMN     "fxRateDate" DATE,
ADD COLUMN     "fxSource" VARCHAR(100),
ADD COLUMN     "hasTime" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "kind" "AssetHistoryKind" NOT NULL DEFAULT 'valuation',
ADD COLUMN     "pricePerUnit" DECIMAL(24,8),
ADD COLUMN     "quantityAfter" DECIMAL(24,8),
ADD COLUMN     "quantityBefore" DECIMAL(24,8),
ADD COLUMN     "reference" VARCHAR(500),
ADD COLUMN     "source" VARCHAR(100),
ADD COLUMN     "status" "AssetEventStatus" NOT NULL DEFAULT 'active',
ADD COLUMN     "timeZone" VARCHAR(64),
ADD COLUMN     "unit" VARCHAR(64),
ADD COLUMN     "valuationModel" "AssetValuationModel" NOT NULL DEFAULT 'total',
ADD COLUMN     "valueBefore" BIGINT,
ADD COLUMN     "voidReason" VARCHAR(500),
ADD COLUMN     "voidedAt" TIMESTAMP(3);

-- A4 backfill. recordedAt is the only timestamp a legacy row has, so it is
-- both the effective instant and the insert time (exact copy, no rounding).
-- effectiveDate is the Asia/Jakarta calendar date of that instant (a UTC
-- midnight date-only row stays on its own date). Only rows that existed
-- before this migration have effectiveAt IS NULL.
UPDATE "asset_history"
SET "effectiveAt"   = "recordedAt",
    "effectiveDate" = (("recordedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta')::date,
    "createdAt"     = "recordedAt",
    "source"        = 'legacy'
WHERE "effectiveAt" IS NULL;

-- The old "Catat nilai" dialog sent a date only, stored as UTC midnight;
-- mark those rows date-only instead of claiming a 00:00 time. System rows
-- (asset create / edit) carry the real insert instant and keep hasTime.
UPDATE "asset_history"
SET "hasTime" = false
WHERE "source" = 'legacy'
  AND "recordedAt" = date_trunc('day', "recordedAt");

-- The row AssetsService.create() wrote right after inserting the asset (no
-- user, no note, within 5 s of assets.createdAt) is the asset's opening
-- value. At most one row per asset; everything else stays 'valuation'.
UPDATE "asset_history" h
SET "kind" = 'opening'
FROM "assets" a
WHERE h."assetId" = a."id"
  AND h."source" = 'legacy'
  AND h."id" = (
    SELECT h2."id"
    FROM "asset_history" h2
    WHERE h2."assetId" = a."id"
      AND h2."source" = 'legacy'
      AND h2."recordedByUserId" IS NULL
      AND h2."note" IS NULL
      AND h2."recordedAt" >= a."createdAt"
      AND h2."recordedAt" < a."createdAt" + INTERVAL '5 seconds'
    ORDER BY h2."recordedAt", h2."id"
    LIMIT 1
  );

ALTER TABLE "asset_history"
  ALTER COLUMN "effectiveAt" SET NOT NULL,
  ALTER COLUMN "effectiveDate" SET NOT NULL,
  ALTER COLUMN "createdAt" SET NOT NULL,
  ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "source" SET NOT NULL,
  ALTER COLUMN "source" SET DEFAULT 'manual';

-- Rollback/upgrade safety: the previous API image (still serving during the
-- compose `migrate` step, and again after an image-retag rollback) inserts
-- asset_history rows WITHOUT effectiveAt/effectiveDate. Fill them from
-- recordedAt with the same rule as the backfill above, instead of failing
-- the NOT NULL. New code always sets them, so this only fires for old code.
-- Known limit: an old image's create() opening row arrives with the column
-- DEFAULT kind = 'valuation' (the trigger cannot tell it from a valuation);
-- its value is still correct, only the event label differs.
CREATE OR REPLACE FUNCTION "asset_history_fill_effective"() RETURNS trigger AS $$
BEGIN
  IF NEW."recordedAt" IS NULL THEN
    NEW."recordedAt" := CURRENT_TIMESTAMP;
  END IF;
  IF NEW."effectiveAt" IS NULL THEN
    NEW."effectiveAt" := NEW."recordedAt";
    NEW."hasTime" := NEW."recordedAt" <> date_trunc('day', NEW."recordedAt");
  END IF;
  IF NEW."effectiveDate" IS NULL THEN
    NEW."effectiveDate" := ((NEW."effectiveAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta')::date;
  END IF;
  IF NEW."kind" IS NULL THEN
    NEW."kind" := 'valuation';
  END IF;
  IF NEW."source" IS NULL THEN
    NEW."source" := 'manual';
  END IF;
  IF NEW."createdAt" IS NULL THEN
    NEW."createdAt" := CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "asset_history_fill_effective"
  BEFORE INSERT ON "asset_history"
  FOR EACH ROW EXECUTE FUNCTION "asset_history_fill_effective"();

-- CreateTable
CREATE TABLE "asset_transactions" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "kind" "AssetTransactionKind" NOT NULL,
    "status" "AssetEventStatus" NOT NULL DEFAULT 'active',
    "quantity" DECIMAL(24,8) NOT NULL,
    "pricePerUnit" DECIMAL(24,8),
    "grossAmount" DECIMAL(24,8),
    "fee" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "tax" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(24,8),
    "currency" VARCHAR(10) NOT NULL DEFAULT 'IDR',
    "fxRate" DECIMAL(24,8),
    "costBasisKnown" BOOLEAN NOT NULL DEFAULT true,
    "realizedPnl" DECIMAL(24,8),
    "effectiveDate" DATE NOT NULL,
    "effectiveTime" VARCHAR(5),
    "timeZone" VARCHAR(64),
    "cashAccountId" TEXT,
    "cashTransactionId" TEXT,
    "idempotencyKey" VARCHAR(64) NOT NULL,
    "note" VARCHAR(1000),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" VARCHAR(500),

    CONSTRAINT "asset_transactions_pkey" PRIMARY KEY ("id")
);

-- R6 (shared with the Investasi ledger) — effectiveTime is "HH:MM" (24h) so
-- it sorts lexically = chronologically.
ALTER TABLE "asset_transactions"
  ADD CONSTRAINT "asset_transactions_effectiveTime_check"
  CHECK ("effectiveTime" IS NULL OR "effectiveTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- CreateIndex
CREATE UNIQUE INDEX "asset_transactions_cashTransactionId_key" ON "asset_transactions"("cashTransactionId");

-- CreateIndex
CREATE INDEX "asset_transactions_assetId_effectiveDate_effectiveTime_crea_idx" ON "asset_transactions"("assetId", "effectiveDate", "effectiveTime", "createdAt", "id");

-- CreateIndex
CREATE INDEX "asset_transactions_familyGroupId_idx" ON "asset_transactions"("familyGroupId");

-- CreateIndex
CREATE INDEX "asset_transactions_cashAccountId_idx" ON "asset_transactions"("cashAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "asset_transactions_familyGroupId_idempotencyKey_key" ON "asset_transactions"("familyGroupId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "asset_history_assetTransactionId_key" ON "asset_history"("assetTransactionId");

-- CreateIndex
CREATE INDEX "asset_history_assetId_effectiveDate_hasTime_effectiveAt_cre_idx" ON "asset_history"("assetId", "effectiveDate", "hasTime", "effectiveAt", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "assets_investmentId_key" ON "assets"("investmentId");

-- CreateIndex
CREATE INDEX "assets_familyGroupId_status_idx" ON "assets"("familyGroupId", "status");

-- CreateIndex
CREATE INDEX "assets_ownerUserId_idx" ON "assets"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "assets_familyGroupId_internalCode_key" ON "assets"("familyGroupId", "internalCode");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "investments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_history" ADD CONSTRAINT "asset_history_assetTransactionId_fkey" FOREIGN KEY ("assetTransactionId") REFERENCES "asset_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
-- NO ACTION (not CASCADE): an asset with ledger rows can never be hard-
-- deleted (A5 archive). Not RESTRICT either: RESTRICT is checked per row
-- immediately and would block deleting a whole family group, whose cascade
-- removes the asset and its transactions in the same statement.
ALTER TABLE "asset_transactions" ADD CONSTRAINT "asset_transactions_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_transactions" ADD CONSTRAINT "asset_transactions_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_transactions" ADD CONSTRAINT "asset_transactions_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_transactions" ADD CONSTRAINT "asset_transactions_cashTransactionId_fkey" FOREIGN KEY ("cashTransactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
