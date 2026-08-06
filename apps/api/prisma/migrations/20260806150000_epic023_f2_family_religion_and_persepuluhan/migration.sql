-- EPIC-023 F2 (D20, US-DON-6/7) — family religion setting (zakat vs.
-- perpuluhan vs. neither) + the obligatory Christian contribution donation
-- type ("persepuluhan"), so PP 60/2010's tax-deductible "sumbangan
-- keagamaan yang sifatnya wajib" can widen beyond zakat to a Christian
-- family's obligatory contribution without misclassifying a voluntary
-- offering (infaq/sedekah/wakaf/lainnya stay non-deductible). Additive
-- only: no DROP, no DELETE, no TRUNCATE, no enum value removed or renamed.
-- Sorts after 20260806120000 (Group E retry 3b).

-- AlterEnum — new value not referenced anywhere else in this same
-- migration file, so this is safe inside a single transaction (PG 12+; see
-- the identical pattern in 20260805010000_add_member_relationship_and_role_tiers).
ALTER TYPE "DonationType" ADD VALUE 'persepuluhan';

-- CreateEnum
CREATE TYPE "FamilyReligion" AS ENUM ('islam', 'kristen', 'none');

-- AlterTable — NOT NULL with a default so every pre-existing family stays
-- valid and keeps seeing exactly what it saw before this setting existed
-- (the donation page always showed the zakat calculator unconditionally):
-- `islam` reproduces that behavior. An owner can correct it immediately via
-- PATCH .../religion — this default is a backward-compat starting point,
-- not an assertion about any family's actual faith.
ALTER TABLE "family_groups" ADD COLUMN "religion" "FamilyReligion" NOT NULL DEFAULT 'islam';
