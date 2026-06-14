import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import { MARKET_DATA_PORT } from "./market-data.port";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PricesGateway } from "./prices.gateway";

import type { MarketDataPort } from "./market-data.port";
import type { Job } from "bullmq";

@Processor("price-refresh")
export class PriceRefreshProcessor extends WorkerHost {
  private readonly logger = new Logger(PriceRefreshProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MARKET_DATA_PORT) private readonly marketData: MarketDataPort,
    private readonly pricesGateway: PricesGateway,
  ) {
    super();
  }

  async process(_job: Job): Promise<void> {
    this.logger.log("Running price refresh job");

    // Fetch all investments (no distinct — we need every row for per-tenant writes)
    const investments = await this.prisma.investment.findMany({
      select: { id: true, ticker: true, familyGroupId: true },
    });

    if (investments.length === 0) {
      this.logger.log("No investments found; skipping price refresh");
      return;
    }

    // Deduplicate tickers for the external price fetch
    const uniqueTickers = [...new Set(investments.map((i) => i.ticker))];
    const tickerPriceMap = new Map<string, { price: number; source: string }>();

    for (const ticker of uniqueTickers) {
      try {
        tickerPriceMap.set(ticker, await this.marketData.getPrice(ticker));
      } catch (err) {
        this.logger.error(`Failed to fetch price for ${ticker}`, err);
      }
    }

    // Write a price record for every investment and broadcast per family group
    for (const inv of investments) {
      const priceData = tickerPriceMap.get(inv.ticker);
      if (!priceData) continue;

      try {
        await this.prisma.investmentPrice.create({
          data: {
            investmentId: inv.id,
            price: new Decimal(priceData.price),
            source: priceData.source,
          },
        });

        this.pricesGateway.broadcastPriceUpdate(
          inv.familyGroupId,
          inv.ticker,
          priceData.price,
          inv.id,
        );

        this.logger.log(
          `Refreshed price for ${inv.ticker} (investment ${inv.id}): ${priceData.price}`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to save price for investment ${inv.id} (${inv.ticker})`,
          err,
        );
      }
    }
  }
}
