-- AlterTable
ALTER TABLE "insurances" ADD COLUMN     "autoRenewDate" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "liabilities" ADD COLUMN     "autoAdvanceDueDate" BOOLEAN NOT NULL DEFAULT false;
