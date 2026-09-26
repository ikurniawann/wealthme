-- Revisi L: detailed PPh OP on tax_records, manual final-income lines, UMKM omzet per year, crypto exchange kind.
CREATE TYPE "TaxMaritalStatus" AS ENUM ('TK', 'K', 'KI');
CREATE TYPE "TaxCalcMode" AS ENUM ('legacy', 'detailed');
CREATE TYPE "TaxFinalInstrument" AS ENUM ('bunga_deposito', 'bunga_tabungan', 'dividen', 'saham_idx', 'kupon_sbn', 'reksa_dana', 'p2p', 'kripto_domestik', 'kripto_luar', 'emas', 'sewa');
CREATE TYPE "CryptoExchangeKind" AS ENUM ('domestik', 'luar_negeri');

ALTER TABLE "tax_records"
  ADD COLUMN "calcMode" "TaxCalcMode" NOT NULL DEFAULT 'legacy',
  ADD COLUMN "maritalStatus" "TaxMaritalStatus",
  ADD COLUMN "dependents" INTEGER,
  ADD COLUMN "pensionContribution" BIGINT,
  ADD COLUMN "freelanceGross" BIGINT,
  ADD COLUMN "nppnRateBps" INTEGER,
  ADD COLUMN "otherNetIncome" BIGINT,
  ADD COLUMN "withheldPph21" BIGINT,
  ADD COLUMN "sptFiledAt" TIMESTAMP(3);

ALTER TABLE "investments" ADD COLUMN "cryptoExchange" "CryptoExchangeKind";

CREATE TABLE "tax_final_income_entries" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "instrument" "TaxFinalInstrument" NOT NULL,
    "grossAmount" BIGINT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "reinvested" BOOLEAN NOT NULL DEFAULT false,
    "rateBpsOverride" INTEGER,
    "investmentId" TEXT,
    "accountId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tax_final_income_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tax_final_income_entries_familyGroupId_taxYear_idx" ON "tax_final_income_entries"("familyGroupId", "taxYear");
CREATE INDEX "tax_final_income_entries_investmentId_idx" ON "tax_final_income_entries"("investmentId");
CREATE INDEX "tax_final_income_entries_accountId_idx" ON "tax_final_income_entries"("accountId");
ALTER TABLE "tax_final_income_entries" ADD CONSTRAINT "tax_final_income_entries_familyGroupId_fkey"
  FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tax_final_income_entries" ADD CONSTRAINT "tax_final_income_entries_investmentId_fkey"
  FOREIGN KEY ("investmentId") REFERENCES "investments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tax_final_income_entries" ADD CONSTRAINT "tax_final_income_entries_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "tax_umkm_years" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "omzetByMonth" BIGINT[],
    "firstRegisteredYear" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tax_umkm_years_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tax_umkm_years_familyGroupId_taxYear_key" ON "tax_umkm_years"("familyGroupId", "taxYear");
ALTER TABLE "tax_umkm_years" ADD CONSTRAINT "tax_umkm_years_familyGroupId_fkey"
  FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
