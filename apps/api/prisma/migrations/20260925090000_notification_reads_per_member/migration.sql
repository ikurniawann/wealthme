-- CreateTable
CREATE TABLE "notification_reads" (
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_reads_pkey" PRIMARY KEY ("notificationId","userId")
);

-- CreateIndex
CREATE INDEX "notification_reads_userId_idx" ON "notification_reads"("userId");

-- AddForeignKey
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: keep what each person sees today. A targeted notification that
-- was read → read by its recipient. A household notification that was read
-- (the old shared flag) → read by every current member of that family, which
-- is exactly the state they saw under the old behaviour.
INSERT INTO "notification_reads" ("notificationId", "userId")
SELECT n."id", n."userId"
FROM "notifications" n
WHERE n."isRead" = true AND n."userId" IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "notification_reads" ("notificationId", "userId")
SELECT n."id", m."userId"
FROM "notifications" n
JOIN "members" m ON m."familyGroupId" = n."familyGroupId" AND m."deletedAt" IS NULL
WHERE n."isRead" = true AND n."userId" IS NULL
ON CONFLICT DO NOTHING;
