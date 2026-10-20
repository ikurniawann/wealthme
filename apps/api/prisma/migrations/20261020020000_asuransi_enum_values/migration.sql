-- Asuransi rebuild, step 1 of 2: enum value additions only.
-- Kept in their own migration because a value added with ALTER TYPE ... ADD
-- VALUE cannot be used inside the same transaction. Purely additive: legacy
-- values (tidak_aktif, kadaluarsa, monthly, quarterly, yearly) stay valid.

-- S2 — policy status gains grace period / lapse / ended / cancelled.
ALTER TYPE "InsuranceStatus" ADD VALUE IF NOT EXISTS 'masa_tenggang';
ALTER TYPE "InsuranceStatus" ADD VALUE IF NOT EXISTS 'lapse';
ALTER TYPE "InsuranceStatus" ADD VALUE IF NOT EXISTS 'berakhir';
ALTER TYPE "InsuranceStatus" ADD VALUE IF NOT EXISTS 'dibatalkan';

-- Premium frequency for the premium schedule (spec §4).
ALTER TYPE "PremiumPeriod" ADD VALUE IF NOT EXISTS 'semiannual';
ALTER TYPE "PremiumPeriod" ADD VALUE IF NOT EXISTS 'single';
ALTER TYPE "PremiumPeriod" ADD VALUE IF NOT EXISTS 'custom';
