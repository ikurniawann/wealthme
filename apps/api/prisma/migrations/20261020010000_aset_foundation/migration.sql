BEGIN;

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

-- AlterTable
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

-- AlterTable
ALTER TABLE "asset_history" ADD COLUMN     "assetTransactionId" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "currency" VARCHAR(10) NOT NULL DEFAULT 'IDR',
ADD COLUMN     "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "fxRate" DECIMAL(24,8),
ADD COLUMN     "fxRateDate" DATE,
ADD COLUMN     "fxSource" VARCHAR(100),
ADD COLUMN     "hasTime" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "kind" "AssetHistoryKind" NOT NULL DEFAULT 'valuation',
ADD COLUMN     "pricePerUnit" DECIMAL(24,8),
ADD COLUMN     "quantityAfter" DECIMAL(24,8),
ADD COLUMN     "quantityBefore" DECIMAL(24,8),
ADD COLUMN     "reference" VARCHAR(500),
ADD COLUMN     "source" VARCHAR(100) NOT NULL DEFAULT 'manual',
ADD COLUMN     "status" "AssetEventStatus" NOT NULL DEFAULT 'active',
ADD COLUMN     "timeZone" VARCHAR(64),
ADD COLUMN     "unit" VARCHAR(64),
ADD COLUMN     "valuationModel" "AssetValuationModel" NOT NULL DEFAULT 'total',
ADD COLUMN     "valueBefore" BIGINT,
ADD COLUMN     "voidReason" VARCHAR(500),
ADD COLUMN     "voidedAt" TIMESTAMP(3);

-- Preserve historical timestamps and monetary values exactly. Legacy costs,
-- quantities, owners and links stay unknown; no acquisition cost is invented.
UPDATE "asset_history"
SET "effectiveAt" = "recordedAt", "createdAt" = "recordedAt", "source" = 'legacy';

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
    "idempotencyKey" TEXT NOT NULL,
    "note" VARCHAR(1000),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" VARCHAR(500),

    CONSTRAINT "asset_transactions_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "assets_investmentId_key" ON "assets"("investmentId");

-- CreateIndex
CREATE INDEX "assets_familyGroupId_status_idx" ON "assets"("familyGroupId", "status");

-- CreateIndex
CREATE INDEX "assets_ownerUserId_idx" ON "assets"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "assets_familyGroupId_internalCode_key" ON "assets"("familyGroupId", "internalCode");

-- CreateIndex
CREATE UNIQUE INDEX "asset_history_assetTransactionId_key" ON "asset_history"("assetTransactionId");

-- CreateIndex
CREATE INDEX "asset_history_assetId_effectiveAt_hasTime_createdAt_id_idx" ON "asset_history"("assetId", "effectiveAt", "hasTime", "createdAt", "id");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "investments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_history" ADD CONSTRAINT "asset_history_assetTransactionId_fkey" FOREIGN KEY ("assetTransactionId") REFERENCES "asset_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_transactions" ADD CONSTRAINT "asset_transactions_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_transactions" ADD CONSTRAINT "asset_transactions_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_transactions" ADD CONSTRAINT "asset_transactions_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_transactions" ADD CONSTRAINT "asset_transactions_cashTransactionId_fkey" FOREIGN KEY ("cashTransactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
