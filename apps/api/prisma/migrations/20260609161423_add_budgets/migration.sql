-- CreateEnum
CREATE TYPE "BudgetPeriod" AS ENUM ('monthly', 'weekly', 'yearly');

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "period" "BudgetPeriod" NOT NULL,
    "limitAmount" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "budgets_familyGroupId_idx" ON "budgets"("familyGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_familyGroupId_categoryId_period_key" ON "budgets"("familyGroupId", "categoryId", "period");

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
