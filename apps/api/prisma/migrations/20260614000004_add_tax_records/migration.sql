-- CreateEnum
CREATE TYPE "SptStatus" AS ENUM ('belum_lapor', 'sudah_lapor', 'terlambat');

-- CreateTable
CREATE TABLE "tax_records" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "grossIncome" BIGINT NOT NULL,
    "ptkp" BIGINT NOT NULL,
    "zakatDeduction" BIGINT NOT NULL DEFAULT 0,
    "netTax" BIGINT NOT NULL DEFAULT 0,
    "sptStatus" "SptStatus" NOT NULL DEFAULT 'belum_lapor',
    "documentUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tax_records_familyGroupId_taxYear_key" ON "tax_records"("familyGroupId", "taxYear");

-- CreateIndex
CREATE INDEX "tax_records_familyGroupId_idx" ON "tax_records"("familyGroupId");

-- AddForeignKey
ALTER TABLE "tax_records" ADD CONSTRAINT "tax_records_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
