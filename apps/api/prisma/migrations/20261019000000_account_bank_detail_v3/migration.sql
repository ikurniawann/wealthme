-- Rekening v3: banking detail on accounts (product, holder, status, deposit
-- terms, foreign routing codes) plus account_shares ("Dibagikan kepada").
-- Purely additive: every new column is nullable or defaulted, so existing
-- rows and non-bank account types are untouched.

-- CreateEnum
CREATE TYPE "BankInstitutionKind" AS ENUM ('commercial', 'digital', 'sharia', 'rural', 'foreign_branch', 'foreign');

-- CreateEnum
CREATE TYPE "BankProductKind" AS ENUM ('savings', 'current', 'time_deposit', 'planned_savings', 'multi_currency');

-- CreateEnum
CREATE TYPE "AccountOwnershipForm" AS ENUM ('individual', 'joint', 'qq');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('active', 'dormant', 'blocked', 'closed');

-- CreateEnum
CREATE TYPE "ShariaContract" AS ENUM ('wadiah', 'mudharabah');

-- CreateEnum
CREATE TYPE "DepositInterestPayout" AS ENUM ('at_maturity', 'monthly');

-- CreateEnum
CREATE TYPE "DepositMaturityInstruction" AS ENUM ('aro', 'aro_plus', 'non_aro');

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "bankCode" VARCHAR(16),
ADD COLUMN     "beneficiaryName" VARCHAR(120),
ADD COLUMN     "beneficiaryUserId" TEXT,
ADD COLUMN     "branch" VARCHAR(120),
ADD COLUMN     "country" VARCHAR(2) NOT NULL DEFAULT 'ID',
ADD COLUMN     "depositNumber" TEXT,
ADD COLUMN     "holderName" VARCHAR(120),
ADD COLUMN     "holderUserId" TEXT,
ADD COLUMN     "institutionKind" "BankInstitutionKind",
ADD COLUMN     "interestPayout" "DepositInterestPayout",
ADD COLUMN     "interestRate" DECIMAL(6,3),
ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isSharia" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maturityInstruction" "DepositMaturityInstruction",
ADD COLUMN     "maturityReminder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maturityReminderSentFor" DATE,
ADD COLUMN     "notes" VARCHAR(1000),
ADD COLUMN     "openingBalance" BIGINT,
ADD COLUMN     "openingBalanceDate" DATE,
ADD COLUMN     "ownershipForm" "AccountOwnershipForm" NOT NULL DEFAULT 'individual',
ADD COLUMN     "payoutAccountId" TEXT,
ADD COLUMN     "placementDate" DATE,
ADD COLUMN     "productKind" "BankProductKind",
ADD COLUMN     "productName" VARCHAR(120),
ADD COLUMN     "reportInTaxReturn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "routingCode" VARCHAR(64),
ADD COLUMN     "routingCodeKind" VARCHAR(16),
ADD COLUMN     "shariaContract" "ShariaContract",
ADD COLUMN     "status" "AccountStatus" NOT NULL DEFAULT 'active',
ADD COLUMN     "swiftCode" VARCHAR(11),
ADD COLUMN     "tenorMonths" INTEGER;

-- CreateTable
CREATE TABLE "account_shares" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canPost" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_shares_userId_idx" ON "account_shares"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "account_shares_accountId_userId_key" ON "account_shares"("accountId", "userId");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_holderUserId_fkey" FOREIGN KEY ("holderUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_beneficiaryUserId_fkey" FOREIGN KEY ("beneficiaryUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_payoutAccountId_fkey" FOREIGN KEY ("payoutAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_shares" ADD CONSTRAINT "account_shares_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_shares" ADD CONSTRAINT "account_shares_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

