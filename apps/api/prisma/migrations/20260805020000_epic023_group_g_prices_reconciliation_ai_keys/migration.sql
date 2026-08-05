-- EPIC-023 Task G — external data: prices, reconciliation, AI keys.
-- Additive only: no DROP, no DELETE, no TRUNCATE, no enum value removed.
-- Sorts after 20260805010000 (Task C's migration).
--
-- 1) InvestmentPrice gains `asOf` (provider's own quote timestamp; nullable —
--    legacy rows have none) and `delayed` (true only for feeds the UI must
--    label delayed/unofficial, e.g. Yahoo `.JK`; default false so existing
--    rows read as "not delayed" until re-priced). See market-data.port.ts.
-- 2) ReconciliationTemplate: one saved column-mapping template per bank per
--    family (D17), so a returning statement imports without remapping.
-- 3) FamilyAiKey: the family's own AI provider key (D16), AES-256-GCM
--    encrypted via the existing CryptoService — never stored plaintext,
--    never returned to the client. One row per family.

-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('claude', 'openai', 'gemini');

-- AlterTable
ALTER TABLE "investment_prices" ADD COLUMN     "asOf" TIMESTAMP(3),
ADD COLUMN     "delayed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "reconciliation_templates" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dateColumn" TEXT NOT NULL,
    "descriptionColumn" TEXT NOT NULL,
    "amountColumn" TEXT NOT NULL,
    "dateFormat" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reconciliation_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_ai_keys" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "keyHint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_ai_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reconciliation_templates_familyGroupId_idx" ON "reconciliation_templates"("familyGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "reconciliation_templates_familyGroupId_bankCode_key" ON "reconciliation_templates"("familyGroupId", "bankCode");

-- CreateIndex
CREATE UNIQUE INDEX "family_ai_keys_familyGroupId_key" ON "family_ai_keys"("familyGroupId");

-- AddForeignKey
ALTER TABLE "reconciliation_templates" ADD CONSTRAINT "reconciliation_templates_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_ai_keys" ADD CONSTRAINT "family_ai_keys_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
