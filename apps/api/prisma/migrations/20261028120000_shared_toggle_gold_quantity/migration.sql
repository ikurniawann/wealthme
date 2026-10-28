-- Additive and idempotent. Staging already carries assets.quantity / assets.unit
-- (aset foundation); a fresh database gets them here. Defaults keep every
-- existing row visible and unchanged.
ALTER TABLE "assets"
  ADD COLUMN IF NOT EXISTS "isPrivate" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "quantity" DECIMAL(24,8),
  ADD COLUMN IF NOT EXISTS "unit" VARCHAR(64);
ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "isPrivate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "liabilities" ADD COLUMN IF NOT EXISTS "isPrivate" BOOLEAN NOT NULL DEFAULT false;
