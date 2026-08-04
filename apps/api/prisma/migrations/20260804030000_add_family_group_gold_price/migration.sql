-- EPIC-021 Group F (#6): user-maintained gold price per gram. Fully
-- additive — both columns are nullable, no backfill required, no drops.
-- No live gold price feed exists or may be fabricated (Open Design
-- Decision #6); this is a single owner-editable value, not a market feed.

-- AlterTable
ALTER TABLE "family_groups" ADD COLUMN "goldPricePerGram" BIGINT;
ALTER TABLE "family_groups" ADD COLUMN "goldPriceUpdatedAt" TIMESTAMP(3);
