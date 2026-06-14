-- CreateEnum
CREATE TYPE "LiabilityType" AS ENUM ('kartu_kredit', 'pinjaman_pribadi', 'kpr', 'kendaraan', 'lainnya');

-- CreateTable
CREATE TABLE "liabilities" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institution" TEXT,
    "type" "LiabilityType" NOT NULL,
    "totalDebt" BIGINT NOT NULL,
    "remainingBalance" BIGINT NOT NULL,
    "minimumPayment" BIGINT NOT NULL DEFAULT 0,
    "interestRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "liabilities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "liabilities_familyGroupId_idx" ON "liabilities"("familyGroupId");

-- AddForeignKey
ALTER TABLE "liabilities" ADD CONSTRAINT "liabilities_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
