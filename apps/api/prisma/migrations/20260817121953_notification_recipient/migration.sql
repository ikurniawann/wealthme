-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "notifications_familyGroupId_userId_createdAt_idx" ON "notifications"("familyGroupId", "userId", "createdAt");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
