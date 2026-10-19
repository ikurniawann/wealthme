import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { InvestmentValuationModule } from "../investments/valuation/investment-valuation.module";

import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { NetWorthSnapshotProcessor } from "./net-worth-snapshot.processor";
import { NetWorthSnapshotScheduler } from "./net-worth-snapshot.scheduler";

import type { Env } from "../config/env";

@Module({
  imports: [
    ConfigModule,
    // Investasi Task 8 — net worth values investments with the shared service.
    InvestmentValuationModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService<Env, true>) => ({
        connection: { url: config.get("REDIS_URL", { infer: true }) },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: "net-worth-snapshot" }),
  ],
  controllers: [DashboardController],
  providers: [
    DashboardService,
    NetWorthSnapshotScheduler,
    NetWorthSnapshotProcessor,
  ],
})
export class DashboardModule {}
