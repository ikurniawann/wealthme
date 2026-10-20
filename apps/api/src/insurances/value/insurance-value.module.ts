import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";

import { InsuranceNetWorthService } from "./insurance-net-worth.service";

/**
 * Asuransi S6 — the shared insurance net-worth helper, imported by
 * InsurancesModule, DashboardModule and ReportsModule (and the Aset overview
 * once it exists). FxModule is global. Kept free of notification/billing
 * dependencies so any reader can import it.
 */
@Module({
  imports: [PrismaModule],
  providers: [InsuranceNetWorthService],
  exports: [InsuranceNetWorthService],
})
export class InsuranceValueModule {}
