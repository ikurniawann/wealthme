-- CreateEnum
CREATE TYPE "AccessDataScope" AS ENUM ('all', 'own');

-- AlterTable
ALTER TABLE "members" ADD COLUMN     "accessOverrides" JSONB,
ADD COLUMN     "accessRoleId" TEXT;

-- CreateTable
CREATE TABLE "access_roles" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "dataScope" "AccessDataScope" NOT NULL DEFAULT 'all',
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "access_roles_familyGroupId_idx" ON "access_roles"("familyGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "access_roles_familyGroupId_name_key" ON "access_roles"("familyGroupId", "name");

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_accessRoleId_fkey" FOREIGN KEY ("accessRoleId") REFERENCES "access_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_roles" ADD CONSTRAINT "access_roles_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

