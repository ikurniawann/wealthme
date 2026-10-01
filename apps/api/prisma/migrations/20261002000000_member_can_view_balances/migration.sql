-- Per-member "Lihat saldo" permission. NOT NULL DEFAULT true backfills every
-- existing member as "balances visible", so nothing changes until the owner
-- turns it off for a specific member.
ALTER TABLE "members" ADD COLUMN "canViewBalances" BOOLEAN NOT NULL DEFAULT true;
