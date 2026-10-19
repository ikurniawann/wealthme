import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";

import { InvestmentValuationService } from "./investment-valuation.service";
import { PriceFeedStatusRegistry } from "./price-feed-status.registry";

/**
 * Investasi Task 8 — the single investment valuation source, imported by
 * InvestmentsModule (list, /investasi summary, price batch, refresh job),
 * DashboardModule (net worth) and ReportsModule (balance sheet). FxModule is
 * global. The feed-status registry lives here so the refresh job and every
 * reader share one instance.
 */
@Module({
  imports: [PrismaModule],
  providers: [InvestmentValuationService, PriceFeedStatusRegistry],
  exports: [InvestmentValuationService, PriceFeedStatusRegistry],
})
export class InvestmentValuationModule {}
