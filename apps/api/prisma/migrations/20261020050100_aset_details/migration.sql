-- Aset fields (2026-10-20), step 2 of 2: structured per-category specs.
-- Nullable, no default, no backfill: existing rows read NULL ("none
-- recorded") and specs typed into `notes` before this release stay there.
-- Older API images neither select nor write the column (Prisma lists
-- columns explicitly), so a rollback by image retag keeps working.
ALTER TABLE "assets" ADD COLUMN "details" JSONB;
