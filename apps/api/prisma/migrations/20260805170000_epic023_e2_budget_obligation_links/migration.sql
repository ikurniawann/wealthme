-- EPIC-023 Task E2 — `Budget` gains optional `liabilityId` / `insuranceId`
-- so the FIXED budget line auto-created for a liability/insurance premium
-- (D11, US-LIAB-3) can be told apart from a user-made budget and the "pay
-- this obligation" flow knows which entity a line seeded. Additive only:
-- nullable columns, no DROP, no DELETE, no TRUNCATE. Every pre-existing row
-- stays valid with both columns NULL.

-- AlterTable
ALTER TABLE "budgets" ADD COLUMN "liabilityId" TEXT;
ALTER TABLE "budgets" ADD COLUMN "insuranceId" TEXT;

-- CreateIndex
CREATE INDEX "budgets_liabilityId_idx" ON "budgets"("liabilityId");

-- CreateIndex
CREATE INDEX "budgets_insuranceId_idx" ON "budgets"("insuranceId");

-- AddForeignKey — ON DELETE RESTRICT: defence-in-depth. The app layer
-- (LiabilitiesService.remove / InsurancesService.remove) already refuses
-- the delete with a friendly 409 while this FK is set, so this constraint
-- should never actually fire; it exists so a bug in that check fails
-- closed (a hard DB error) instead of silently orphaning the budget line.
ALTER TABLE "budgets"
  ADD CONSTRAINT "budgets_liabilityId_fkey"
  FOREIGN KEY ("liabilityId") REFERENCES "liabilities"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets"
  ADD CONSTRAINT "budgets_insuranceId_fkey"
  FOREIGN KEY ("insuranceId") REFERENCES "insurances"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
