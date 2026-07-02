import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { PrismaModule } from "../prisma/prisma.module";

import { GoalAutoDebitProcessor } from "./goal-auto-debit.processor";
import { GoalAutoDebitScheduler } from "./goal-auto-debit.scheduler";
import { GoalsController } from "./goals.controller";
import { GoalsService } from "./goals.service";

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
    BullModule.registerQueue({ name: "goal-auto-debit" }),
  ],
  controllers: [GoalsController],
  providers: [GoalsService, GoalAutoDebitScheduler, GoalAutoDebitProcessor],
})
export class GoalsModule {}
