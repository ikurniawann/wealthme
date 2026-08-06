-- EPIC-023 Task E1 — `Transaction` gains optional `liabilityId` /
-- `insuranceId` so paying a liability/insurance premium creates ONE
-- transaction linked to the obligation it settles (D10, US-LIAB-4,
-- US-INS-4): one ledger, one truth. Additive only: nullable columns, no
-- DROP, no DELETE, no TRUNCATE. Every pre-existing row stays valid with
-- both columns NULL.

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "liabilityId" TEXT;
ALTER TABLE "transactions" ADD COLUMN "insuranceId" TEXT;

-- CreateIndex
CREATE INDEX "transactions_liabilityId_idx" ON "transactions"("liabilityId");

-- CreateIndex
CREATE INDEX "transactions_insuranceId_idx" ON "transactions"("insuranceId");

-- AddForeignKey — ON DELETE SET NULL: deleting a Liability/Insurance must
-- never cascade-delete the transaction history it accumulated; the row
-- just loses its "paid this obligation" attribution, mirroring
-- `categoryId`/`createdByUserId` above.
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_liabilityId_fkey"
  FOREIGN KEY ("liabilityId") REFERENCES "liabilities"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_insuranceId_fkey"
  FOREIGN KEY ("insuranceId") REFERENCES "insurances"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
