-- Aset Task 18 — idempotent valuation writes (R7 parity with the ledger).
-- Additive and nullable: legacy rows and older API images never set it, and
-- Postgres UNIQUE treats every NULL as distinct.
ALTER TABLE "asset_history" ADD COLUMN "idempotencyKey" VARCHAR(64);

CREATE UNIQUE INDEX "asset_history_assetId_idempotencyKey_key"
  ON "asset_history"("assetId", "idempotencyKey");
