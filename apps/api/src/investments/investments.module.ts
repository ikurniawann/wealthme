import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";

import { PrismaModule } from "../prisma/prisma.module";

import { InvestmentsController } from "./investments.controller";
import { InvestmentsService } from "./investments.service";
import { MARKET_DATA_PORT } from "./market-data.port";
import { MockMarketDataAdapter } from "./mock-market-data.adapter";
import { PriceRefreshProcessor } from "./price-refresh.processor";
import { PriceRefreshScheduler } from "./price-refresh.scheduler";
import { PricesGateway } from "./prices.gateway";

import type { Env } from "../config/env";

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get("JWT_SECRET", { infer: true }),
      }),
      inject: [ConfigService],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService<Env, true>) => ({
        connection: { url: config.get("REDIS_URL", { infer: true }) },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: "price-refresh" }),
  ],
  controllers: [InvestmentsController],
  providers: [
    InvestmentsService,
    { provide: MARKET_DATA_PORT, useClass: MockMarketDataAdapter },
    PriceRefreshProcessor,
    PriceRefreshScheduler,
    PricesGateway,
  ],
  exports: [InvestmentsService],
})
export class InvestmentsModule {}
