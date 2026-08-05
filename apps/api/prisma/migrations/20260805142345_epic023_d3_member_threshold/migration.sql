-- CreateEnum
CREATE TYPE "AllowanceRequestKind" AS ENUM ('funding', 'held_expense');

-- AlterTable
ALTER TABLE "allowance_requests" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "kind" "AllowanceRequestKind" NOT NULL DEFAULT 'funding';

-- AlterTable
ALTER TABLE "members" ADD COLUMN     "largeTxnThreshold" BIGINT;

-- CreateIndex
CREATE INDEX "allowance_requests_categoryId_idx" ON "allowance_requests"("categoryId");

-- AddForeignKey
ALTER TABLE "allowance_requests" ADD CONSTRAINT "allowance_requests_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
