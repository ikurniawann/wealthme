-- EPIC-024 C2 (D7, D10) — additive, safe: a new enum value plus two
-- nullable columns. No backfill, no drops, applies cleanly to a DB with
-- existing `investments` rows (both new columns default to NULL).
--
-- Timestamp ordering note (epic "Migration ordering hazard"): this is the
-- first Wave-3 migration authored (C2 → D2 → J1 within the wave), given a
-- timestamp AFTER the latest migration present in this directory as of
-- writing (20260806170000_epic023_f_religion_unconfirmed) and after Group
-- A3's staged backfill (docs/migrations/epic-024-a3-istri-owner-backfill.sql
-- — staged outside this directory, applied separately by a human; not a
-- schema migration, so it does not appear in this directory's ordering at
-- all).

-- AlterEnum: PostgreSQL requires ALTER TYPE ... ADD VALUE outside an
-- explicit multi-statement transaction block in older PG versions, but
-- Prisma's migration runner applies each migration.sql file as its own
-- statement-by-statement run, which is the same safe pattern already used
-- by 20260805010000_add_member_relationship_and_role_tiers and
-- 20260804000001_epic021_group_d_heirs_beneficiaries in this repo.
ALTER TYPE "InvestmentType" ADD VALUE 'deposito';

-- AlterTable: Investment gains "tanggal beli" (purchasedAt, every type) and
-- "jatuh tempo" (maturityDate, deposito only — null for every other type).
ALTER TABLE "investments" ADD COLUMN "purchasedAt" TIMESTAMP(3);
ALTER TABLE "investments" ADD COLUMN "maturityDate" TIMESTAMP(3);
