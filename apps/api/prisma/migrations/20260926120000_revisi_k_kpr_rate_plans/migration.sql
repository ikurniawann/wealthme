-- Revisi K: KPR scheme label, tiered rate periods, recorded floating-rate changes. Additive; existing rows untouched.
CREATE TYPE "KprScheme" AS ENUM ('konvensional', 'berjenjang', 'flpp', 'syariah_murabahah', 'syariah_mmq');

CREATE TYPE "RatePeriodKind" AS ENUM ('fixed', 'floating');

ALTER TABLE "liabilities" ADD COLUMN "kprScheme" "KprScheme";

CREATE TABLE "liability_rate_periods" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "liabilityId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "kind" "RatePeriodKind" NOT NULL,
    "months" INTEGER,
    "ratePercent" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "liability_rate_periods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "liability_floating_rates" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "liabilityId" TEXT NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "note" VARCHAR(200),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liability_floating_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "liability_rate_periods_liabilityId_sequence_key" ON "liability_rate_periods"("liabilityId", "sequence");

CREATE INDEX "liability_rate_periods_familyGroupId_idx" ON "liability_rate_periods"("familyGroupId");

CREATE UNIQUE INDEX "liability_floating_rates_liabilityId_effectiveDate_key" ON "liability_floating_rates"("liabilityId", "effectiveDate");

CREATE INDEX "liability_floating_rates_familyGroupId_idx" ON "liability_floating_rates"("familyGroupId");

ALTER TABLE "liability_rate_periods" ADD CONSTRAINT "liability_rate_periods_liabilityId_fkey" FOREIGN KEY ("liabilityId") REFERENCES "liabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "liability_floating_rates" ADD CONSTRAINT "liability_floating_rates_liabilityId_fkey" FOREIGN KEY ("liabilityId") REFERENCES "liabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
