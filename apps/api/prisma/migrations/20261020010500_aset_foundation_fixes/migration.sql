-- Aset foundation fixes (Task 16 review + Task 17 fix), applied ON TOP of
-- 20261020010000_aset_foundation exactly as first written (that migration is
-- already applied on dev and must keep its checksum). Correct both on dev
-- (original applied earlier, API still on the old image meanwhile) and on a
-- fresh database (both run back to back).
--
-- Every asset_history row that exists when this runs was written by code
-- that never set the effective fields: legacy rows, and rows the previous
-- API image inserted after the foundation migration (which took
-- effectiveAt = insert time from the column default). The new effectiveDate
-- column is NULL exactly for those rows and is the marker below. No value,
-- recordedAt or note is rewritten.

-- AlterTable — calendar date of the effective point (Asia/Jakarta when
-- timeZone is null). Added nullable, backfilled, then tightened.
ALTER TABLE "asset_history" ADD COLUMN "effectiveDate" DATE;

-- A4 backfill: recordedAt is the date the user gave, so effectiveAt is it
-- (the foundation's default stamped post-migration rows with "now"). The old
-- "Catat nilai" dialog sent a date only, stored as UTC midnight: those rows
-- are date-only (hasTime=false), never a claimed 00:00 time.
UPDATE "asset_history"
SET "effectiveAt" = "recordedAt",
    "hasTime"     = ("recordedAt" <> date_trunc('day', "recordedAt"))
WHERE "effectiveDate" IS NULL
  AND "assetTransactionId" IS NULL;

-- The row AssetsService.create() wrote right after inserting the asset (no
-- user, no note, within 5 s of assets.createdAt) is the asset's opening
-- value. At most one row per asset; everything else stays 'valuation'.
UPDATE "asset_history" h
SET "kind" = 'opening'
FROM "assets" a
WHERE h."assetId" = a."id"
  AND h."effectiveDate" IS NULL
  AND h."kind" = 'valuation'
  AND h."id" = (
    SELECT h2."id"
    FROM "asset_history" h2
    WHERE h2."assetId" = a."id"
      AND h2."effectiveDate" IS NULL
      AND h2."recordedByUserId" IS NULL
      AND h2."note" IS NULL
      AND h2."recordedAt" >= a."createdAt"
      AND h2."recordedAt" < a."createdAt" + INTERVAL '5 seconds'
    ORDER BY h2."recordedAt", h2."id"
    LIMIT 1
  );

-- effectiveDate = Asia/Jakarta calendar date of effectiveAt (a UTC-midnight
-- date-only row stays on its own date).
UPDATE "asset_history"
SET "effectiveDate" = (("effectiveAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta')::date
WHERE "effectiveDate" IS NULL;

-- No default on effectiveAt: new code must state the effective point; the
-- trigger below fills it for older API images (rollback safety), never "now".
ALTER TABLE "asset_history"
  ALTER COLUMN "effectiveDate" SET NOT NULL,
  ALTER COLUMN "effectiveAt" DROP DEFAULT;

-- Rollback/upgrade safety: the previous API image (still serving during the
-- compose `migrate` step, and again after an image-retag rollback) inserts
-- asset_history rows WITHOUT effectiveAt/effectiveDate. Fill them from
-- recordedAt with the same rule as the backfill above, instead of failing
-- the NOT NULL. New code always sets them, so this only fires for old code.
-- Known limit: an old image's create() opening row arrives with the column
-- DEFAULT kind = 'valuation' (the trigger cannot tell it from a valuation);
-- its value is still correct, only the event label differs.
CREATE OR REPLACE FUNCTION "asset_history_fill_effective"() RETURNS trigger AS $$
BEGIN
  IF NEW."recordedAt" IS NULL THEN
    NEW."recordedAt" := CURRENT_TIMESTAMP;
  END IF;
  IF NEW."effectiveAt" IS NULL THEN
    NEW."effectiveAt" := NEW."recordedAt";
    NEW."hasTime" := NEW."recordedAt" <> date_trunc('day', NEW."recordedAt");
  END IF;
  IF NEW."effectiveDate" IS NULL THEN
    NEW."effectiveDate" := ((NEW."effectiveAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta')::date;
  END IF;
  IF NEW."kind" IS NULL THEN
    NEW."kind" := 'valuation';
  END IF;
  IF NEW."source" IS NULL THEN
    NEW."source" := 'manual';
  END IF;
  IF NEW."createdAt" IS NULL THEN
    NEW."createdAt" := CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "asset_history_fill_effective" ON "asset_history";
CREATE TRIGGER "asset_history_fill_effective"
  BEFORE INSERT ON "asset_history"
  FOR EACH ROW EXECUTE FUNCTION "asset_history_fill_effective"();

-- A4 order (effectiveDate, date-only first, effectiveAt, createdAt, id).
DROP INDEX IF EXISTS "asset_history_assetId_effectiveAt_hasTime_createdAt_id_idx";
CREATE INDEX "asset_history_assetId_effectiveDate_hasTime_effectiveAt_cre_idx" ON "asset_history"("assetId", "effectiveDate", "hasTime", "effectiveAt", "createdAt", "id");

-- R7 key length parity with the Investasi ledger (uuid per form open).
ALTER TABLE "asset_transactions" ALTER COLUMN "idempotencyKey" SET DATA TYPE VARCHAR(64);

-- R6 (shared with the Investasi ledger) — effectiveTime is "HH:MM" (24h) so
-- it sorts lexically = chronologically.
ALTER TABLE "asset_transactions"
  ADD CONSTRAINT "asset_transactions_effectiveTime_check"
  CHECK ("effectiveTime" IS NULL OR "effectiveTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- NO ACTION (not CASCADE): an asset with ledger rows can never be hard-
-- deleted (A5 archive). Not RESTRICT either: RESTRICT is checked per row
-- immediately and would block deleting a whole family group, whose cascade
-- removes the asset and its transactions in the same statement.
ALTER TABLE "asset_transactions" DROP CONSTRAINT "asset_transactions_assetId_fkey";
ALTER TABLE "asset_transactions" ADD CONSTRAINT "asset_transactions_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
