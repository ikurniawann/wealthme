-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('on_track', 'needs_boost', 'achieved', 'at_risk');

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "targetAmount" BIGINT NOT NULL,
    "currentAmount" BIGINT NOT NULL DEFAULT 0,
    "targetDate" TIMESTAMP(3),
    "autoDebitAmount" BIGINT,
    "status" "GoalStatus" NOT NULL DEFAULT 'on_track',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "goals_familyGroupId_idx" ON "goals"("familyGroupId");

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
