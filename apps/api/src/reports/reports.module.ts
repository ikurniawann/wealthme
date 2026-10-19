import { Module } from "@nestjs/common";

import { InvestmentValuationModule } from "../investments/valuation/investment-valuation.module";

import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({
  // Investasi Task 8 — the balance sheet values investments with the shared service.
  imports: [InvestmentValuationModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
