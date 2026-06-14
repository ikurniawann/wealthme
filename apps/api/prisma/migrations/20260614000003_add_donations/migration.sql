-- CreateEnum
CREATE TYPE "DonationType" AS ENUM ('zakat_maal', 'zakat_fitrah', 'infaq', 'sedekah', 'wakaf', 'lainnya');

-- CreateTable
CREATE TABLE "donations" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "type" "DonationType" NOT NULL,
    "recipient" VARCHAR(200) NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IDR',
    "donatedAt" TIMESTAMP(3) NOT NULL,
    "isTaxDeductible" BOOLEAN NOT NULL DEFAULT false,
    "receiptUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "donations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "donations_familyGroupId_donatedAt_idx" ON "donations"("familyGroupId", "donatedAt");

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
