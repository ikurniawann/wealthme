import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { PrismaModule } from "../prisma/prisma.module";

import { BillingCycleProcessor } from "./billing-cycle.processor";
import { BillingCycleScheduler } from "./billing-cycle.scheduler";

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
    BullModule.registerQueue({ name: "billing-cycle" }),
  ],
  providers: [BillingCycleProcessor, BillingCycleScheduler],
})
export class BillingCycleModule {}
