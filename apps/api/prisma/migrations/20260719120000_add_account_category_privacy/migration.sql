-- AlterTable
ALTER TABLE "accounts" ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "categories" ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT false;
