-- EPIC-024 Task L2 (D15, US-TXN-9) — transaction attachments (receipts,
-- photos) stored on server disk behind StoragePort/StorageDiskService.
-- Additive only: no DROP, no DELETE, no TRUNCATE.
-- Sorts after Group J's migration (20260807120000) per the epic's documented
-- wave-4 migration-ordering hazard (parallel worktrees have collided on
-- migration timestamps in this repo before — EPIC-023's recorded hazard).
--
-- `path` stores the storage KEY returned by StorageDiskService.upload() (a
-- server-generated UUID-based key), never the client-supplied filename —
-- see StorageDiskService and the attachments controller/service for the
-- path-traversal defense this schema choice supports.
-- `familyGroupId` is denormalized alongside `transactionId` so every
-- read/delete can be tenant-scoped in one indexed WHERE without a join.

-- CreateTable
CREATE TABLE "transaction_attachments" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transaction_attachments_transactionId_familyGroupId_idx" ON "transaction_attachments"("transactionId", "familyGroupId");

-- CreateIndex
CREATE INDEX "transaction_attachments_familyGroupId_idx" ON "transaction_attachments"("familyGroupId");

-- AddForeignKey
ALTER TABLE "transaction_attachments" ADD CONSTRAINT "transaction_attachments_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_attachments" ADD CONSTRAINT "transaction_attachments_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
