import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { PrismaModule } from "../prisma/prisma.module";

import { CoinGeckoMarketDataAdapter } from "./coingecko-market-data.adapter";
import { InvestmentsController } from "./investments.controller";
import { InvestmentsService } from "./investments.service";
import { MARKET_DATA_PORT } from "./market-data.port";
import { MockMarketDataAdapter } from "./mock-market-data.adapter";
import { PriceRefreshProcessor } from "./price-refresh.processor";
import { PriceRefreshScheduler } from "./price-refresh.scheduler";
import { PricesGateway } from "./prices.gateway";
import { RoutedMarketDataAdapter } from "./routed-market-data.adapter";
import { YahooFinanceMarketDataAdapter } from "./yahoo-finance-market-data.adapter";

import type { Env } from "../config/env";

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
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
    {
      // EPIC-023 G1 (D15) — behind the same MARKET_DATA_PORT token, route by
      // instrument type: crypto → CoinGecko, IDX equities → Yahoo `.JK`
      // (delayed & unofficial). Mock stays the default so local/dev/test
      // runs never depend on network access or real API rate limits.
      provide: MARKET_DATA_PORT,
      useFactory: (config: ConfigService<Env, true>) => {
        const useReal = config.get("USE_REAL_MARKET_DATA", { infer: true });
        if (useReal === "true") {
          return new RoutedMarketDataAdapter(
            new CoinGeckoMarketDataAdapter(),
            new YahooFinanceMarketDataAdapter(),
          );
        }
        return new MockMarketDataAdapter();
      },
      inject: [ConfigService],
    },
    PriceRefreshProcessor,
    PriceRefreshScheduler,
    PricesGateway,
  ],
  exports: [InvestmentsService],
})
export class InvestmentsModule {}
