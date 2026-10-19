-- CreateEnum
CREATE TYPE "InvestmentTxKind" AS ENUM ('buy', 'sell', 'opening', 'dividend', 'coupon', 'interest', 'corporate_action');

-- CreateEnum
CREATE TYPE "InvestmentTxStatus" AS ENUM ('active', 'void');

-- CreateEnum
CREATE TYPE "InvestmentMarket" AS ENUM ('IDX', 'NASDAQ', 'NYSE', 'CRYPTO', 'MUTUAL_FUND_ID', 'BOND_ID', 'GOLD', 'DEPOSIT', 'OTHER');

-- CreateEnum
CREATE TYPE "PocketKind" AS ENUM ('rdn', 'crypto', 'usd', 'general');

-- CreateEnum
CREATE TYPE "PlatformSyncMode" AS ENUM ('manual');

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "platformAccountId" TEXT,
ADD COLUMN     "pocketKind" "PocketKind";

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "idempotencyKey" VARCHAR(64);

-- AlterTable
ALTER TABLE "investments" ADD COLUMN     "allowFraction" BOOLEAN,
ADD COLUMN     "cashAccountId" TEXT,
ADD COLUMN     "details" JSONB,
ADD COLUMN     "lotSize" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "market" "InvestmentMarket",
ADD COLUMN     "ownerUserId" TEXT,
ADD COLUMN     "platformAccountId" TEXT,
ADD COLUMN     "priceSymbol" VARCHAR(64),
ALTER COLUMN "costBasisPerUnit" SET DATA TYPE DECIMAL(24,8);

-- AlterTable — columns that must be NOT NULL are added nullable, backfilled
-- below, then tightened, so existing rows never violate the constraint.
ALTER TABLE "investment_transactions" ADD COLUMN     "cashAccountId" TEXT,
ADD COLUMN     "cashTransactionId" TEXT,
ADD COLUMN     "currency" VARCHAR(10) NOT NULL DEFAULT 'IDR',
ADD COLUMN     "effectiveDate" DATE,
ADD COLUMN     "effectiveTime" VARCHAR(5),
ADD COLUMN     "familyGroupId" TEXT,
ADD COLUMN     "fee" DECIMAL(24,8) NOT NULL DEFAULT 0,
ADD COLUMN     "feeCurrency" VARCHAR(10),
ADD COLUMN     "fxRate" DECIMAL(24,6),
ADD COLUMN     "grossAmount" DECIMAL(24,8),
ADD COLUMN     "idempotencyKey" VARCHAR(64),
ADD COLUMN     "kind" "InvestmentTxKind",
ADD COLUMN     "netAmount" DECIMAL(24,8),
ADD COLUMN     "note" VARCHAR(1000),
ADD COLUMN     "settlementDate" DATE,
ADD COLUMN     "status" "InvestmentTxStatus" NOT NULL DEFAULT 'active',
ADD COLUMN     "tax" DECIMAL(24,8) NOT NULL DEFAULT 0,
ADD COLUMN     "timeZone" VARCHAR(64),
ADD COLUMN     "updatedAt" TIMESTAMP(3),
ADD COLUMN     "voidReason" VARCHAR(500),
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ALTER COLUMN "type" DROP NOT NULL,
ALTER COLUMN "pricePerUnit" SET DATA TYPE DECIMAL(24,8);

-- Backfill existing ledger rows. Every legacy amount was stored in IDR (FX was
-- converted at entry), there were no fees/taxes, and no row ever recorded a
-- time of day (the web sent date-only values as UTC midnight), so
-- effectiveTime stays NULL (date-only) and the calendar date is taken in
-- Asia/Jakarta, which keeps a UTC-midnight date on the same day.
UPDATE "investment_transactions" t
SET "familyGroupId" = i."familyGroupId"
FROM "investments" i
WHERE t."investmentId" = i."id" AND t."familyGroupId" IS NULL;

UPDATE "investment_transactions"
SET "kind"          = ("type"::text)::"InvestmentTxKind",
    "effectiveDate" = (("occurredAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta')::date,
    "grossAmount"   = ROUND("quantity" * "pricePerUnit", 2),
    "netAmount"     = ROUND("quantity" * "pricePerUnit", 2),
    "updatedAt"     = "createdAt"
WHERE "kind" IS NULL;

-- R5 — legacy holdings without any ledger row get a synthetic `opening`
-- (kepemilikan awal) carrying today's quantity and average cost, dated
-- purchasedAt ?? createdAt (date-only). It never debits cash (no
-- cashAccountId). Holdings with quantity 0 have nothing to open. `type` is
-- "buy" so the pre-rebuild UI keeps reading it as a quantity increase.
INSERT INTO "investment_transactions" (
  "id", "investmentId", "familyGroupId", "type", "kind", "quantity",
  "pricePerUnit", "occurredAt", "realizedPnl", "effectiveDate",
  "grossAmount", "netAmount", "currency", "status", "note",
  "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text, i."id", i."familyGroupId", 'buy', 'opening',
  i."quantity", i."costBasisPerUnit",
  COALESCE(i."purchasedAt", i."createdAt"), NULL,
  ((COALESCE(i."purchasedAt", i."createdAt") AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta')::date,
  ROUND(i."quantity" * i."costBasisPerUnit", 2),
  ROUND(i."quantity" * i."costBasisPerUnit", 2),
  'IDR', 'active',
  'Kepemilikan awal dari data sebelum pembaruan modul Investasi',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "investments" i
WHERE i."quantity" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "investment_transactions" t WHERE t."investmentId" = i."id"
  );

ALTER TABLE "investment_transactions"
  ALTER COLUMN "familyGroupId" SET NOT NULL,
  ALTER COLUMN "kind" SET NOT NULL,
  ALTER COLUMN "effectiveDate" SET NOT NULL,
  ALTER COLUMN "grossAmount" SET NOT NULL,
  ALTER COLUMN "netAmount" SET NOT NULL,
  ALTER COLUMN "updatedAt" SET NOT NULL;

-- R6 — effectiveTime is "HH:MM" (24h) so it sorts lexically = chronologically.
ALTER TABLE "investment_transactions"
  ADD CONSTRAINT "investment_transactions_effectiveTime_check"
  CHECK ("effectiveTime" IS NULL OR "effectiveTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- AlterTable
ALTER TABLE "investment_prices" ADD COLUMN     "currency" VARCHAR(10) NOT NULL DEFAULT 'IDR',
ADD COLUMN     "hasTime" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "reference" VARCHAR(500),
ADD COLUMN     "unitLabel" VARCHAR(32),
ALTER COLUMN "price" SET DATA TYPE DECIMAL(24,8);

-- R5 — only IDR saham rows are known to be IDX shares; other legacy saham rows
-- keep market NULL and the UI asks the user to complete it. Quantities are
-- not rewritten (they are already in lembar).
UPDATE "investments"
SET "market" = 'IDX', "lotSize" = 100
WHERE "type" = 'saham' AND "currency" = 'IDR' AND "market" IS NULL;

-- Legacy manual prices were entered as a date only (sent as UTC midnight);
-- mark them date-only instead of claiming a 00:00 quote time.
UPDATE "investment_prices"
SET "hasTime" = false
WHERE "source" = 'manual'
  AND "asOf" IS NOT NULL
  AND "asOf"::time = TIME '00:00:00';

-- CreateTable
CREATE TABLE "platform_accounts" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "platformKey" VARCHAR(40) NOT NULL,
    "customName" VARCHAR(120),
    "ownerUserId" TEXT,
    "label" VARCHAR(120),
    "accountRef" TEXT,
    "syncMode" "PlatformSyncMode" NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_attachments" (
    "id" TEXT NOT NULL,
    "investmentId" TEXT NOT NULL,
    "investmentTransactionId" TEXT,
    "familyGroupId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investment_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_accounts_familyGroupId_idx" ON "platform_accounts"("familyGroupId");

-- CreateIndex
CREATE INDEX "platform_accounts_ownerUserId_idx" ON "platform_accounts"("ownerUserId");

-- CreateIndex
CREATE INDEX "investment_attachments_investmentId_familyGroupId_idx" ON "investment_attachments"("investmentId", "familyGroupId");

-- CreateIndex
CREATE INDEX "investment_attachments_investmentTransactionId_idx" ON "investment_attachments"("investmentTransactionId");

-- CreateIndex
CREATE INDEX "investment_attachments_familyGroupId_idx" ON "investment_attachments"("familyGroupId");

-- CreateIndex
CREATE INDEX "accounts_platformAccountId_idx" ON "accounts"("platformAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_familyGroupId_idempotencyKey_key" ON "transactions"("familyGroupId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "investments_platformAccountId_idx" ON "investments"("platformAccountId");

-- CreateIndex
CREATE INDEX "investments_cashAccountId_idx" ON "investments"("cashAccountId");

-- CreateIndex
CREATE INDEX "investments_ownerUserId_idx" ON "investments"("ownerUserId");

-- CreateIndex
CREATE INDEX "investment_transactions_investmentId_effectiveDate_idx" ON "investment_transactions"("investmentId", "effectiveDate");

-- CreateIndex
CREATE INDEX "investment_transactions_cashAccountId_idx" ON "investment_transactions"("cashAccountId");

-- CreateIndex
CREATE INDEX "investment_transactions_cashTransactionId_idx" ON "investment_transactions"("cashTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "investment_transactions_familyGroupId_idempotencyKey_key" ON "investment_transactions"("familyGroupId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_platformAccountId_fkey" FOREIGN KEY ("platformAccountId") REFERENCES "platform_accounts"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_accounts" ADD CONSTRAINT "platform_accounts_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_accounts" ADD CONSTRAINT "platform_accounts_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investments" ADD CONSTRAINT "investments_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investments" ADD CONSTRAINT "investments_platformAccountId_fkey" FOREIGN KEY ("platformAccountId") REFERENCES "platform_accounts"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investments" ADD CONSTRAINT "investments_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_cashTransactionId_fkey" FOREIGN KEY ("cashTransactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_attachments" ADD CONSTRAINT "investment_attachments_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "investments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_attachments" ADD CONSTRAINT "investment_attachments_investmentTransactionId_fkey" FOREIGN KEY ("investmentTransactionId") REFERENCES "investment_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_attachments" ADD CONSTRAINT "investment_attachments_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

