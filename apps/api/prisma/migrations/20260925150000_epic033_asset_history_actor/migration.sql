-- EPIC-033 group 3 (p16/p17): who recorded an asset value, and why.
ALTER TABLE "asset_history" ADD COLUMN "recordedByUserId" TEXT;
ALTER TABLE "asset_history" ADD COLUMN "note" TEXT;
