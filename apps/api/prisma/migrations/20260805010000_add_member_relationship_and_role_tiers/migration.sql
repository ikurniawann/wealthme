-- EPIC-023 Task C — two axes: `Member.relationship` (kinship, purely
-- descriptive, grants no permission) and three new `Role` tiers (spouse,
-- dependant, operational) alongside the unchanged owner/member/admin_staff.
-- Also adds `Transaction.createdByUserId` so a row-scoped role (dependant/
-- operational) can be restricted to "an account they own or a transaction
-- they recorded" (see common/utils/privacy.util.ts). Additive only: no
-- DROP, no DELETE, no TRUNCATE, no enum value removed or renamed. Sorts
-- after 20260805000000 (Task A's migration).

-- AlterEnum — new values are not referenced anywhere else in this same
-- migration file, so this is safe inside a single transaction (PG 12+; see
-- the identical pattern in 20260804000001_epic021_group_d_heirs_beneficiaries).
ALTER TYPE "Role" ADD VALUE 'spouse';
ALTER TYPE "Role" ADD VALUE 'dependant';
ALTER TYPE "Role" ADD VALUE 'operational';

-- CreateEnum — purely descriptive kinship; carries no permission of its own.
-- The default-role-per-relationship mapping lives in packages/contracts,
-- not the database.
CREATE TYPE "MemberRelationship" AS ENUM ('istri', 'anak', 'kakek', 'nenek', 'bibi', 'supir', 'sekretaris', 'bendahara');

-- AlterTable — nullable kinship on Member. Every existing row stays valid
-- with relationship = NULL.
ALTER TABLE "members" ADD COLUMN "relationship" "MemberRelationship";

-- AlterTable — optional kinship carried from invite to acceptance, for the
-- roles that still arrive by email (spouse, bookkeeper — D6).
ALTER TABLE "invitations" ADD COLUMN "relationship" "MemberRelationship";

-- AlterTable — who recorded a transaction. Nullable, NOT backfilled: every
-- pre-existing row stays NULL, which correctly means a newly row-scoped
-- member sees none of the pre-existing household ledger.
ALTER TABLE "transactions" ADD COLUMN "createdByUserId" TEXT;

-- CreateIndex
CREATE INDEX "transactions_createdByUserId_idx" ON "transactions"("createdByUserId");

-- AddForeignKey — ON DELETE SET NULL: a user leaving the family (or being
-- removed) must never cascade-delete transaction history; the row just
-- loses its "recorded by" attribution.
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
