import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { ReportsModule } from "../reports/reports.module";

import { ExportsController } from "./exports.controller";
import { ExportsProcessor } from "./exports.processor";
import { EXPORT_QUEUE, ExportsService } from "./exports.service";

import type { Env } from "../config/env";

@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: EXPORT_QUEUE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        connection: { url: config.get("REDIS_URL", { infer: true }) },
      }),
    }),
    ReportsModule,
  ],
  controllers: [ExportsController],
  providers: [ExportsService, ExportsProcessor],
})
export class ExportsModule {}
