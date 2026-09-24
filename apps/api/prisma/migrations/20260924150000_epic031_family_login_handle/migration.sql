-- AlterTable
ALTER TABLE "users" ADD COLUMN     "managedByFamilyGroupId" TEXT;

-- AlterTable
ALTER TABLE "family_groups" ADD COLUMN     "handle" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "family_groups_handle_key" ON "family_groups"("handle");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_managedByFamilyGroupId_fkey" FOREIGN KEY ("managedByFamilyGroupId") REFERENCES "family_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill (EPIC-031): every existing family gets a login handle derived from
-- the first word of its name plus 6 chars of its id (unique by construction;
-- the Master can rename it from /iam). Mirrors slugifyHandleBase() in
-- @wealthme/contracts.
UPDATE "family_groups"
SET "handle" = (
  CASE
    WHEN length(left(regexp_replace(lower(split_part(trim("name"), ' ', 1)), '[^a-z0-9]', '', 'g'), 16)) >= 3
      THEN left(regexp_replace(lower(split_part(trim("name"), ' ', 1)), '[^a-z0-9]', '', 'g'), 16)
    ELSE 'keluarga'
  END
) || '-' || left(replace("id", '-', ''), 6)
WHERE "handle" IS NULL;

-- Backfill: logins a Master created before EPIC-031 (synthetic .invalid email)
-- belong to the family they were created in (their oldest membership).
-- Their plain usernames are left untouched so nobody's login changes.
UPDATE "users" u
SET "managedByFamilyGroupId" = m."familyGroupId"
FROM (
  SELECT DISTINCT ON ("userId") "userId", "familyGroupId"
  FROM "members"
  ORDER BY "userId", "createdAt" ASC
) m
WHERE m."userId" = u."id"
  AND u."email" LIKE '%@members.internal.wealthme.invalid'
  AND u."managedByFamilyGroupId" IS NULL;
