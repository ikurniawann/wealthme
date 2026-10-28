-- "Shared with others" toggle. Additive and idempotent: the default keeps
-- every existing row visible exactly as before.
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "isPrivate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "isPrivate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "liabilities" ADD COLUMN IF NOT EXISTS "isPrivate" BOOLEAN NOT NULL DEFAULT false;
