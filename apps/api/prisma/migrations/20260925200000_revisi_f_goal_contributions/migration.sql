-- Revisi F (catalog item 5): real payments into a goal + the goal's auto-debit source account.
CREATE TYPE "GoalContributionSource" AS ENUM ('manual', 'auto');

ALTER TABLE "goals" ADD COLUMN "sourceAccountId" TEXT;
CREATE INDEX "goals_sourceAccountId_idx" ON "goals"("sourceAccountId");
ALTER TABLE "goals" ADD CONSTRAINT "goals_sourceAccountId_fkey"
  FOREIGN KEY ("sourceAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "goal_contributions" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "accountId" TEXT,
    "transactionId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "source" "GoalContributionSource" NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "goal_contributions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "goal_contributions_transactionId_key" ON "goal_contributions"("transactionId");
CREATE INDEX "goal_contributions_familyGroupId_goalId_occurredAt_idx" ON "goal_contributions"("familyGroupId", "goalId", "occurredAt");
CREATE INDEX "goal_contributions_accountId_idx" ON "goal_contributions"("accountId");
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_familyGroupId_fkey"
  FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_goalId_fkey"
  FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
