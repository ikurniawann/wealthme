-- CreateEnum
CREATE TYPE "CoaDirection" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');

-- CreateEnum
CREATE TYPE "CoaBudgetType" AS ENUM ('FIXED', 'VARIABLE', 'REIMBURSEMENT');

-- CreateTable
CREATE TABLE "coa_accounts" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupNum" INTEGER NOT NULL,
    "direction" "CoaDirection" NOT NULL,
    "budgetType" "CoaBudgetType",
    "parentCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coa_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coa_accounts_familyGroupId_idx" ON "coa_accounts"("familyGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "coa_accounts_familyGroupId_code_key" ON "coa_accounts"("familyGroupId", "code");

-- AddForeignKey
ALTER TABLE "coa_accounts" ADD CONSTRAINT "coa_accounts_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
