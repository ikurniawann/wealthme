-- CreateEnum
CREATE TYPE "InsuranceType" AS ENUM ('jiwa', 'kesehatan', 'kendaraan', 'properti', 'lainnya');

-- CreateEnum
CREATE TYPE "InsuranceStatus" AS ENUM ('aktif', 'tidak_aktif', 'kadaluarsa');

-- CreateEnum
CREATE TYPE "PremiumPeriod" AS ENUM ('monthly', 'quarterly', 'yearly');

-- CreateTable
CREATE TABLE "insurances" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "provider" VARCHAR(150),
    "type" "InsuranceType" NOT NULL,
    "status" "InsuranceStatus" NOT NULL DEFAULT 'aktif',
    "coverageAmount" BIGINT,
    "premiumAmount" BIGINT NOT NULL,
    "premiumPeriod" "PremiumPeriod" NOT NULL DEFAULT 'monthly',
    "renewalDate" TIMESTAMP(3),
    "policyNumber" VARCHAR(100),
    "notes" VARCHAR(500),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IDR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "insurances_familyGroupId_idx" ON "insurances"("familyGroupId");

-- AddForeignKey
ALTER TABLE "insurances" ADD CONSTRAINT "insurances_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
