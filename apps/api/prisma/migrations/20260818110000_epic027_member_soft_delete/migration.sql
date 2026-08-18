-- EPIC-027 A7 (D4) — soft-delete for family members.
--
-- Additive and backward compatible: every existing row keeps deletedAt NULL,
-- which the Prisma query extension reads as "active", so no behaviour changes
-- until a member is actually removed.
ALTER TABLE "members" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Every read path filters on deletedAt IS NULL within a family group; the
-- existing familyGroupId index alone would still scan removed rows.
CREATE INDEX "members_familyGroupId_deletedAt_idx" ON "members"("familyGroupId", "deletedAt");
