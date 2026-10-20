-- Aset fields (2026-10-20), step 1 of 2: enum value addition only.
-- Kept in its own migration because a value added with ALTER TYPE ... ADD
-- VALUE cannot be used inside the same transaction. Purely additive: every
-- existing AssetType value stays valid, and older API images never write it.
ALTER TYPE "AssetType" ADD VALUE IF NOT EXISTS 'seni_koleksi';
