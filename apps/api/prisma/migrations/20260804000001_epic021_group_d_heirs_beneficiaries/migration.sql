-- EPIC-021 Group D (#11, #12, #13, #14) — warisan/asuransi heirs & beneficiaries.
-- All changes are additive: a new enum value, two nullable columns, and one
-- new table. Existing rows are untouched and remain valid.

-- #13 — add "pendidikan" to InsuranceType so education policies stop being
-- coerced into "lainnya" on save. Not used elsewhere in this migration, so
-- it's safe to run in the same transaction as the DDL below (PG 12+).
-- AlterEnum
ALTER TYPE "InsuranceType" ADD VALUE 'pendidikan';

-- #11 — optional link from an inheritance asset back to the source Asset it
-- was picked from ("Pilih dari Aset" mode). Unenforced FK (no constraint),
-- matching the existing Donation.accountId pattern in this schema.
-- AlterTable
ALTER TABLE "inheritance_assets" ADD COLUMN "assetId" TEXT;

-- Decision #9 — optional link from a heir to a family-group member (User.id),
-- alongside the existing free-text name/relationship. Same unenforced-FK
-- pattern as above.
-- AlterTable
ALTER TABLE "inheritance_heirs" ADD COLUMN "memberUserId" TEXT;

-- #14 — insurance policy beneficiaries, sharing InheritanceHeir's shape.
-- CreateTable
CREATE TABLE "insurance_beneficiaries" (
    "id" TEXT NOT NULL,
    "insuranceId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "relationship" VARCHAR(100) NOT NULL,
    "sharePercent" DECIMAL(5,2) NOT NULL,
    "memberUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insurance_beneficiaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "insurance_beneficiaries_insuranceId_idx" ON "insurance_beneficiaries"("insuranceId");

-- AddForeignKey
ALTER TABLE "insurance_beneficiaries" ADD CONSTRAINT "insurance_beneficiaries_insuranceId_fkey" FOREIGN KEY ("insuranceId") REFERENCES "insurances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
