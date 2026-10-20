-- Asuransi rebuild, step 2 of 2: additive columns/tables + data backfills.
-- Rulings S1-S5, S7 (docs/superpowers/plans/2026-10-19-kas-dark-investasi.md).
-- Nothing is dropped or renamed; legacy columns (renewalDate,
-- coverageAmount) stay populated and readable.

-- CreateEnum
CREATE TYPE "InsurancePolicyType" AS ENUM ('traditional', 'unit_link');

-- CreateEnum
CREATE TYPE "InsuranceBenefitKind" AS ENUM ('life_sum_assured', 'health_annual_limit', 'per_event', 'daily', 'critical_illness', 'accident', 'other');

-- CreateEnum
CREATE TYPE "InsuranceBenefitPeriod" AS ENUM ('per_year', 'per_event', 'per_day', 'per_policy_term', 'lifetime');

-- CreateEnum
CREATE TYPE "InsuranceValuationSource" AS ENUM ('manual', 'report');

-- CreateEnum
CREATE TYPE "InsuranceValuationStatus" AS ENUM ('ai_extracted', 'needs_confirmation', 'confirmed');

-- AlterTable
ALTER TABLE "insurances" ADD COLUMN     "coverageEndDate" DATE,
ADD COLUMN     "coverageStartDate" DATE,
ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "holderName" VARCHAR(150),
ADD COLUMN     "holderUserId" TEXT,
ADD COLUMN     "includeInNetWorth" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nextPremiumDueDate" DATE,
ADD COLUMN     "payerName" VARCHAR(150),
ADD COLUMN     "payerUserId" TEXT,
ADD COLUMN     "paymentAccountId" TEXT,
ADD COLUMN     "policyRenewalDate" DATE,
ADD COLUMN     "policyType" "InsurancePolicyType",
ADD COLUMN     "premiumPaymentEndDate" DATE;

-- CreateTable
CREATE TABLE "insurance_insured" (
    "id" TEXT NOT NULL,
    "insuranceId" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "relationship" VARCHAR(100),
    "memberUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insurance_insured_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_benefits" (
    "id" TEXT NOT NULL,
    "insuranceId" TEXT NOT NULL,
    "kind" "InsuranceBenefitKind" NOT NULL,
    "label" VARCHAR(150),
    "amount" DECIMAL(24,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IDR',
    "period" "InsuranceBenefitPeriod",
    "note" VARCHAR(500),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "confirmed" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_benefits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_funds" (
    "id" TEXT NOT NULL,
    "insuranceId" TEXT NOT NULL,
    "code" VARCHAR(40),
    "name" VARCHAR(150) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IDR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_funds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_valuations" (
    "id" TEXT NOT NULL,
    "insuranceId" TEXT NOT NULL,
    "fundId" TEXT,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IDR',
    "units" DECIMAL(24,8),
    "navPerUnit" DECIMAL(24,8),
    "navDate" DATE,
    "unitsDate" DATE,
    "reportedValue" DECIMAL(24,4),
    "cashValue" DECIMAL(24,4),
    "surrenderEstimate" DECIMAL(24,4),
    "maturityBenefit" DECIMAL(24,4),
    "guaranteed" BOOLEAN NOT NULL DEFAULT false,
    "effectiveDate" DATE NOT NULL,
    "source" "InsuranceValuationSource" NOT NULL DEFAULT 'manual',
    "documentId" TEXT,
    "page" INTEGER,
    "snippet" VARCHAR(1000),
    "status" "InsuranceValuationStatus" NOT NULL DEFAULT 'needs_confirmation',
    "confirmedAt" TIMESTAMP(3),
    "confirmedByUserId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_valuations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_payments" (
    "id" TEXT NOT NULL,
    "insuranceId" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "dueDate" DATE,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(24,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IDR',
    "accountId" TEXT,
    "transactionId" TEXT,
    "idempotencyKey" VARCHAR(64),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insurance_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_documents" (
    "id" TEXT NOT NULL,
    "insuranceId" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "reportDate" DATE,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insurance_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_shares" (
    "id" TEXT NOT NULL,
    "insuranceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insurance_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "insurance_insured_insuranceId_idx" ON "insurance_insured"("insuranceId");

-- CreateIndex
CREATE INDEX "insurance_insured_memberUserId_idx" ON "insurance_insured"("memberUserId");

-- CreateIndex
CREATE INDEX "insurance_benefits_insuranceId_idx" ON "insurance_benefits"("insuranceId");

-- CreateIndex
CREATE INDEX "insurance_funds_insuranceId_idx" ON "insurance_funds"("insuranceId");

-- CreateIndex
CREATE INDEX "insurance_valuations_insuranceId_effectiveDate_idx" ON "insurance_valuations"("insuranceId", "effectiveDate");

-- CreateIndex
CREATE INDEX "insurance_valuations_fundId_effectiveDate_idx" ON "insurance_valuations"("fundId", "effectiveDate");

-- CreateIndex
CREATE INDEX "insurance_valuations_documentId_idx" ON "insurance_valuations"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_payments_transactionId_key" ON "insurance_payments"("transactionId");

-- CreateIndex
CREATE INDEX "insurance_payments_familyGroupId_idx" ON "insurance_payments"("familyGroupId");

-- CreateIndex
CREATE INDEX "insurance_payments_insuranceId_dueDate_idx" ON "insurance_payments"("insuranceId", "dueDate");

-- CreateIndex
CREATE INDEX "insurance_payments_accountId_idx" ON "insurance_payments"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_payments_insuranceId_idempotencyKey_key" ON "insurance_payments"("insuranceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "insurance_documents_insuranceId_familyGroupId_idx" ON "insurance_documents"("insuranceId", "familyGroupId");

-- CreateIndex
CREATE INDEX "insurance_shares_userId_idx" ON "insurance_shares"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_shares_insuranceId_userId_key" ON "insurance_shares"("insuranceId", "userId");

-- CreateIndex
CREATE INDEX "insurances_familyGroupId_nextPremiumDueDate_idx" ON "insurances"("familyGroupId", "nextPremiumDueDate");

-- CreateIndex
CREATE INDEX "insurances_holderUserId_idx" ON "insurances"("holderUserId");

-- CreateIndex
CREATE INDEX "insurances_payerUserId_idx" ON "insurances"("payerUserId");

-- CreateIndex
CREATE INDEX "insurances_paymentAccountId_idx" ON "insurances"("paymentAccountId");

-- AddForeignKey
ALTER TABLE "insurances" ADD CONSTRAINT "insurances_holderUserId_fkey" FOREIGN KEY ("holderUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurances" ADD CONSTRAINT "insurances_payerUserId_fkey" FOREIGN KEY ("payerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurances" ADD CONSTRAINT "insurances_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_insured" ADD CONSTRAINT "insurance_insured_insuranceId_fkey" FOREIGN KEY ("insuranceId") REFERENCES "insurances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_benefits" ADD CONSTRAINT "insurance_benefits_insuranceId_fkey" FOREIGN KEY ("insuranceId") REFERENCES "insurances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_funds" ADD CONSTRAINT "insurance_funds_insuranceId_fkey" FOREIGN KEY ("insuranceId") REFERENCES "insurances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_valuations" ADD CONSTRAINT "insurance_valuations_insuranceId_fkey" FOREIGN KEY ("insuranceId") REFERENCES "insurances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_valuations" ADD CONSTRAINT "insurance_valuations_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "insurance_funds"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_valuations" ADD CONSTRAINT "insurance_valuations_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "insurance_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_payments" ADD CONSTRAINT "insurance_payments_insuranceId_fkey" FOREIGN KEY ("insuranceId") REFERENCES "insurances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_payments" ADD CONSTRAINT "insurance_payments_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_payments" ADD CONSTRAINT "insurance_payments_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_documents" ADD CONSTRAINT "insurance_documents_insuranceId_fkey" FOREIGN KEY ("insuranceId") REFERENCES "insurances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_shares" ADD CONSTRAINT "insurance_shares_insuranceId_fkey" FOREIGN KEY ("insuranceId") REFERENCES "insurances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_shares" ADD CONSTRAINT "insurance_shares_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- S5 — a valuation row never carries both a reported value and units × NAV
-- (two representations of the same value would double-count).
ALTER TABLE "insurance_valuations" ADD CONSTRAINT "insurance_valuations_single_representation_chk"
  CHECK (NOT ("reportedValue" IS NOT NULL AND "units" IS NOT NULL AND "navPerUnit" IS NOT NULL));

-- ── Backfills ───────────────────────────────────────────────────────────────

-- S1 — the legacy renewalDate's runtime meaning is "next premium due" (pay()
-- and the billing worker advance it), so it is copied into
-- nextPremiumDueDate ONLY. It is never copied into coverageEndDate or
-- policyRenewalDate: which meaning a user typed cannot be known, and a
-- coverage end must never drive a premium reminder. renewalDate stays as-is.
-- renewalDate holds UTC midnight (timestamp without time zone), so ::date
-- keeps the calendar day.
UPDATE "insurances"
SET "nextPremiumDueDate" = "renewalDate"::date
WHERE "renewalDate" IS NOT NULL
  AND "nextPremiumDueDate" IS NULL;

-- S4 — the legacy single coverageAmount becomes ONE benefit, marked
-- confirmed = false (the user has not reviewed its kind). Kind is
-- life_sum_assured for jiwa, otherwise other — never guessed further.
-- Zero/empty coverage is not turned into a benefit (empty data never becomes
-- a value). coverageAmount itself is left populated. Legacy amounts were
-- entered in IDR (the web never sent a currency), so the policy currency is
-- used as recorded.
INSERT INTO "insurance_benefits"
  ("id", "insuranceId", "kind", "amount", "currency", "isPrimary", "confirmed", "sortOrder", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  i."id",
  (CASE WHEN i."type" = 'jiwa' THEN 'life_sum_assured' ELSE 'other' END)::"InsuranceBenefitKind",
  i."coverageAmount"::numeric,
  i."currency",
  true,
  false,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "insurances" i
WHERE i."coverageAmount" IS NOT NULL
  AND i."coverageAmount" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "insurance_benefits" b WHERE b."insuranceId" = i."id"
  );

-- S7 — one payment row per existing premium payment: an EXPENSE transaction
-- linked to a policy of the SAME family. Ledger amounts are IDR. The due date
-- each one settled is unknown, so dueDate stays null (never guessed).
-- ON CONFLICT keeps the one-payment-per-transaction rule.
INSERT INTO "insurance_payments"
  ("id", "insuranceId", "familyGroupId", "dueDate", "paidAt", "amount", "currency", "accountId", "transactionId", "createdByUserId", "createdAt")
SELECT
  gen_random_uuid()::text,
  t."insuranceId",
  t."familyGroupId",
  NULL,
  t."occurredAt",
  t."amount"::numeric,
  'IDR',
  t."accountId",
  t."id",
  t."createdByUserId",
  t."createdAt"
FROM "transactions" t
JOIN "insurances" i
  ON i."id" = t."insuranceId"
 AND i."familyGroupId" = t."familyGroupId"
WHERE t."insuranceId" IS NOT NULL
  AND t."type" = 'expense'
ON CONFLICT ("transactionId") DO NOTHING;
