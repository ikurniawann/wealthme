-- CreateTable
CREATE TABLE "gold_market_prices" (
    "id" TEXT NOT NULL,
    "source" VARCHAR(32) NOT NULL,
    "pricePerKgIdr" BIGINT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gold_market_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gold_market_prices_source_key" ON "gold_market_prices"("source");
