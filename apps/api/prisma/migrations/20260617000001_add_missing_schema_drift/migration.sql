-- Migration: add_missing_schema_drift
-- Captures schema fields and tables that were added to schema.prisma
-- but not recorded in prior migrations (Better Auth tables, emailVerified,
-- budgets, goals, notifications, split_bills, bank_syncs, etc.).

-- CreateEnum
CREATE TYPE "BudgetPeriod" AS ENUM ('monthly', 'weekly', 'yearly');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('on_track', 'needs_boost', 'achieved', 'at_risk');

-- CreateEnum
CREATE TYPE "SplitStatus" AS ENUM ('open', 'settled');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('pending', 'paid');

-- CreateEnum
CREATE TYPE "ReconStatus" AS ENUM ('matched', 'unmatched', 'suggested');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "image" TEXT;

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "familyGroupId" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "icon" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "split_bills" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "totalAmount" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IDR',
    "shareToken" TEXT NOT NULL,
    "status" "SplitStatus" NOT NULL DEFAULT 'open',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "split_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "split_participants" (
    "id" TEXT NOT NULL,
    "splitBillId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "amountOwed" BIGINT NOT NULL,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "split_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_syncs" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rowCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "bank_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_sync_entries" (
    "id" TEXT NOT NULL,
    "bankSyncId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "reconStatus" "ReconStatus" NOT NULL DEFAULT 'unmatched',
    "matchedTxId" TEXT,
    "suggestedTxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_sync_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "budgets_familyGroupId_idx" ON "budgets"("familyGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_familyGroupId_categoryId_period_key" ON "budgets"("familyGroupId", "categoryId", "period");

-- CreateIndex
CREATE INDEX "goals_familyGroupId_idx" ON "goals"("familyGroupId");

-- CreateIndex
CREATE INDEX "notifications_familyGroupId_idx" ON "notifications"("familyGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "split_bills_shareToken_key" ON "split_bills"("shareToken");

-- CreateIndex
CREATE INDEX "split_bills_familyGroupId_idx" ON "split_bills"("familyGroupId");

-- CreateIndex
CREATE INDEX "split_bills_shareToken_idx" ON "split_bills"("shareToken");

-- CreateIndex
CREATE INDEX "split_participants_splitBillId_idx" ON "split_participants"("splitBillId");

-- CreateIndex
CREATE INDEX "bank_syncs_familyGroupId_idx" ON "bank_syncs"("familyGroupId");

-- CreateIndex
CREATE INDEX "bank_sync_entries_bankSyncId_idx" ON "bank_sync_entries"("bankSyncId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split_bills" ADD CONSTRAINT "split_bills_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split_participants" ADD CONSTRAINT "split_participants_splitBillId_fkey" FOREIGN KEY ("splitBillId") REFERENCES "split_bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_syncs" ADD CONSTRAINT "bank_syncs_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_sync_entries" ADD CONSTRAINT "bank_sync_entries_bankSyncId_fkey" FOREIGN KEY ("bankSyncId") REFERENCES "bank_syncs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
