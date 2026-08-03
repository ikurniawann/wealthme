-- EPIC-021 Group B (#23/#27/#28): real source -> destination transfers.
-- Decision (coordinated with EPIC-019 Decision #1): single Transaction row +
-- nullable `toAccountId` FK, NOT paired debit/credit legs. Purely additive:
-- the column is nullable, so every existing transaction (including legacy
-- one-sided "transfer" rows) keeps `toAccountId = NULL` and renders exactly
-- as before. No drops, no backfill needed.
--
-- onDelete: RESTRICT (not SET NULL/CASCADE) on the new FK — an account that
-- has ever been the destination of a transfer must not be deletable out from
-- under its own transaction history. The pre-existing `accountId` FK (source
-- leg) stays CASCADE, unchanged.

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "toAccountId" TEXT;

-- CreateIndex
CREATE INDEX "transactions_toAccountId_idx" ON "transactions"("toAccountId");

-- AddForeignKey
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_toAccountId_fkey"
  FOREIGN KEY ("toAccountId") REFERENCES "accounts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
