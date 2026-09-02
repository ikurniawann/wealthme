-- EPIC-022 D2 — additive only: a new enum plus a new table with an FK to
-- the existing `investments` table. No DROP, no DELETE, no ALTER on any
-- existing column. Fixes the "edit silently overwrites quantity/cost with
-- no trace" defect by giving buy/sell events a real, append-only home.

-- CreateEnum
CREATE TYPE "InvestmentTxType" AS ENUM ('buy', 'sell');

-- CreateTable
CREATE TABLE "investment_transactions" (
    "id" TEXT NOT NULL,
    "investmentId" TEXT NOT NULL,
    "type" "InvestmentTxType" NOT NULL,
    "quantity" DECIMAL(18,8) NOT NULL,
    "pricePerUnit" DECIMAL(18,2) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "realizedPnl" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "investment_transactions_investmentId_occurredAt_idx" ON "investment_transactions"("investmentId", "occurredAt");

-- AddForeignKey
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "investments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
