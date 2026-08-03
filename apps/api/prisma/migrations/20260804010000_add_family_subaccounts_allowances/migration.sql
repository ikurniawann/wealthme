-- EPIC-019 Task A/B/C — family sub-accounts & role-scoped allowances.
-- Purely additive: a nullable FK column, and two new tables. No drops, no
-- backfill required — every existing account/member keeps behaving exactly
-- as it does today (ownerUserId = NULL means family-shared; a member with
-- zero MemberCategoryAllowance rows stays unrestricted).

-- CreateEnum
CREATE TYPE "AllowanceRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable: Task A — nullable per-member account ownership.
ALTER TABLE "accounts" ADD COLUMN "ownerUserId" TEXT;

-- CreateIndex
CREATE INDEX "accounts_ownerUserId_idx" ON "accounts"("ownerUserId");

-- AddForeignKey
-- ON DELETE SET NULL: removing the owning user reverts the account to
-- family-shared instead of destroying it or blocking the user's deletion.
ALTER TABLE "accounts"
  ADD CONSTRAINT "accounts_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: Task B — member-request -> owner-approve funding requests.
CREATE TABLE "allowance_requests" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "targetAccountId" TEXT NOT NULL,
    "fromAccountId" TEXT,
    "amount" BIGINT NOT NULL,
    "note" TEXT,
    "status" "AllowanceRequestStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedByUserId" TEXT,

    CONSTRAINT "allowance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "allowance_requests_familyGroupId_status_idx" ON "allowance_requests"("familyGroupId", "status");

-- CreateIndex
CREATE INDEX "allowance_requests_requesterUserId_idx" ON "allowance_requests"("requesterUserId");

-- AddForeignKey
ALTER TABLE "allowance_requests"
  ADD CONSTRAINT "allowance_requests_familyGroupId_fkey"
  FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allowance_requests"
  ADD CONSTRAINT "allowance_requests_requesterUserId_fkey"
  FOREIGN KEY ("requesterUserId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allowance_requests"
  ADD CONSTRAINT "allowance_requests_targetAccountId_fkey"
  FOREIGN KEY ("targetAccountId") REFERENCES "accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allowance_requests"
  ADD CONSTRAINT "allowance_requests_fromAccountId_fkey"
  FOREIGN KEY ("fromAccountId") REFERENCES "accounts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allowance_requests"
  ADD CONSTRAINT "allowance_requests_decidedByUserId_fkey"
  FOREIGN KEY ("decidedByUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: Task C — per-member expense category allow-list.
CREATE TABLE "member_category_allowances" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_category_allowances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "member_category_allowances_memberId_categoryId_key" ON "member_category_allowances"("memberId", "categoryId");

-- CreateIndex
CREATE INDEX "member_category_allowances_memberId_idx" ON "member_category_allowances"("memberId");

-- AddForeignKey
ALTER TABLE "member_category_allowances"
  ADD CONSTRAINT "member_category_allowances_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "members"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_category_allowances"
  ADD CONSTRAINT "member_category_allowances_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "categories"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
