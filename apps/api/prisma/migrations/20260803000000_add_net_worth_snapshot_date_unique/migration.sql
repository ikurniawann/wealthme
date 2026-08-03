-- QA-sweep #6: NetWorthSnapshot double-write risk.
-- Additive + self-healing: adds a calendar-day `date` column, backfills it
-- from the existing `capturedAt` timestamp, dedupes any rows that already
-- collide on (familyGroupId, date) — keeping the most recently captured row
-- per day — then enforces NOT NULL + a unique index so the application can
-- upsert instead of check-then-insert (closing the race that produced the
-- duplicates in the first place). No drops.

-- 1. Add the column nullable so the backfill can run before NOT NULL is enforced.
ALTER TABLE "net_worth_snapshots" ADD COLUMN "date" DATE;

-- 2. Backfill: the calendar day of the existing capturedAt timestamp.
UPDATE "net_worth_snapshots"
SET "date" = "capturedAt"::date
WHERE "date" IS NULL;

-- 3. Dedupe: keep only the latest-captured row per (familyGroupId, date),
--    breaking any remaining tie by id so exactly one row per pair survives.
DELETE FROM "net_worth_snapshots" a
USING "net_worth_snapshots" b
WHERE a."familyGroupId" = b."familyGroupId"
  AND a."date" = b."date"
  AND (
    a."capturedAt" < b."capturedAt"
    OR (a."capturedAt" = b."capturedAt" AND a."id" < b."id")
  );

-- 4. Enforce NOT NULL + unique index.
ALTER TABLE "net_worth_snapshots" ALTER COLUMN "date" SET NOT NULL;

CREATE UNIQUE INDEX "net_worth_snapshots_familyGroupId_date_key" ON "net_worth_snapshots"("familyGroupId", "date");
