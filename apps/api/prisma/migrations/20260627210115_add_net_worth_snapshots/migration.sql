-- CreateTable
CREATE TABLE "net_worth_snapshots" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalCash" BIGINT NOT NULL,
    "totalInvestments" BIGINT NOT NULL,
    "totalAssets" BIGINT NOT NULL,
    "totalLiabilities" BIGINT NOT NULL,
    "netWorth" BIGINT NOT NULL,

    CONSTRAINT "net_worth_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "net_worth_snapshots_familyGroupId_capturedAt_idx" ON "net_worth_snapshots"("familyGroupId", "capturedAt");

-- AddForeignKey
ALTER TABLE "net_worth_snapshots" ADD CONSTRAINT "net_worth_snapshots_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
