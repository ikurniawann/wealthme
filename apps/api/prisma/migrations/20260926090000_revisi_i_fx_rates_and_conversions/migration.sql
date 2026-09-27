-- Revisi I (catalog item 18): cached ECB FX rates + audit of foreign-currency money inputs.
CREATE TABLE "fx_rates" (
    "id" TEXT NOT NULL,
    "source" VARCHAR(32) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "rateDate" DATE NOT NULL,
    "idrPerUnit" DECIMAL(24,6) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fx_rates_source_currency_rateDate_key" ON "fx_rates"("source", "currency", "rateDate");
CREATE INDEX "fx_rates_currency_rateDate_idx" ON "fx_rates"("currency", "rateDate");

CREATE TABLE "fx_conversions" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "entity" VARCHAR(48) NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" VARCHAR(96) NOT NULL,
    "originalAmount" DECIMAL(24,2) NOT NULL,
    "originalCurrency" VARCHAR(3) NOT NULL,
    "idrAmount" DECIMAL(24,2) NOT NULL,
    "idrPerUnit" DECIMAL(24,6) NOT NULL,
    "rateDate" DATE NOT NULL,
    "rateSource" VARCHAR(32) NOT NULL,
    "rateStale" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fx_conversions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "fx_conversions_familyGroupId_entity_entityId_idx" ON "fx_conversions"("familyGroupId", "entity", "entityId");
ALTER TABLE "fx_conversions" ADD CONSTRAINT "fx_conversions_familyGroupId_fkey"
  FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fx_conversions" ADD CONSTRAINT "fx_conversions_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
