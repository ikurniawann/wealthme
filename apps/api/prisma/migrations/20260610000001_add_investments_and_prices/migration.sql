-- CreateEnum
CREATE TYPE "InvestmentType" AS ENUM ('saham', 'reksa_dana', 'obligasi', 'emas', 'kripto', 'lainnya');

-- CreateTable
CREATE TABLE "investments" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "InvestmentType" NOT NULL,
    "quantity" DECIMAL(18,8) NOT NULL,
    "costBasisPerUnit" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_prices" (
    "id" TEXT NOT NULL,
    "investmentId" TEXT NOT NULL,
    "price" DECIMAL(18,2) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'mock',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investment_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "investments_familyGroupId_idx" ON "investments"("familyGroupId");

-- CreateIndex
CREATE INDEX "investment_prices_investmentId_recordedAt_idx" ON "investment_prices"("investmentId", "recordedAt");

-- AddForeignKey
ALTER TABLE "investments" ADD CONSTRAINT "investments_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_prices" ADD CONSTRAINT "investment_prices_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "investments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
