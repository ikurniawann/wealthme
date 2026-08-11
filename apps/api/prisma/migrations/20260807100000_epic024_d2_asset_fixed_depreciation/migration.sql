-- EPIC-024 D2/US-ASSET-6: additive columns only — no data mutation, no
-- backfill required. Existing rows get DEFAULT 'percent' for the new NOT
-- NULL enum column (their projection behavior is unchanged: percent mode
-- reading the existing valueChangeRatePct, exactly as before this
-- migration), and NULL for the new nullable valueChangeAmount column.

-- CreateEnum
CREATE TYPE "AssetValueChangeMode" AS ENUM ('percent', 'fixed');

-- AlterTable
ALTER TABLE "assets"
  ADD COLUMN     "valueChangeMode" "AssetValueChangeMode" NOT NULL DEFAULT 'percent',
  ADD COLUMN     "valueChangeAmount" BIGINT;
