import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import { isAutomatedPriceType, MARKET_DATA_PORT } from "./market-data.port";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PricesGateway } from "./prices.gateway";

import type { MarketDataPort, MarketDataQuote } from "./market-data.port";
import type { InvestmentType } from "@prisma/client";
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
      select: { id: true, ticker: true, type: true, familyGroupId: true },
    });

    if (investments.length === 0) {
      this.logger.log("No investments found; skipping price refresh");
      return;
    }

    // EPIC-023 G1 (D15) — manual-only types (reksa_dana, obligasi, emas,
    // lainnya) never get an automated quote; skip them entirely so this
    // background job never fabricates a price for them.
    const automatedInvestments = investments.filter((inv) =>
      isAutomatedPriceType(inv.type),
    );

    if (automatedInvestments.length === 0) {
      this.logger.log(
        "No automatable (saham/kripto) investments found; skipping price refresh",
      );
      return;
    }

    // Deduplicate by (ticker, type) for the external price fetch — the same
    // ticker string could theoretically appear under different types.
    const uniqueKeys = new Map<
      string,
      { ticker: string; type: InvestmentType }
    >();
    for (const inv of automatedInvestments) {
      uniqueKeys.set(`${inv.ticker}::${inv.type}`, {
        ticker: inv.ticker,
        type: inv.type,
      });
    }
    const priceMap = new Map<string, MarketDataQuote>();

    for (const { ticker, type } of uniqueKeys.values()) {
      try {
        priceMap.set(
          `${ticker}::${type}`,
          await this.marketData.getPrice(ticker, type),
        );
      } catch (err) {
        this.logger.error(`Failed to fetch price for ${ticker} (${type})`, err);
      }
    }

    // Write a price record for every investment and broadcast per family group
    for (const inv of automatedInvestments) {
      const priceData = priceMap.get(`${inv.ticker}::${inv.type}`);
      if (!priceData) continue;

      try {
        await this.prisma.investmentPrice.create({
          data: {
            investmentId: inv.id,
            price: new Decimal(priceData.price),
            source: priceData.source,
            asOf: priceData.asOf,
            delayed: priceData.delayed,
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
