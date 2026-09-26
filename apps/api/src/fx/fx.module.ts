import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { PrismaService } from "../prisma/prisma.service";

import { FrankfurterFxService } from "./frankfurter-fx.service";
import { FrankfurterClient } from "./frankfurter.client";
import { FxMockService } from "./fx-mock.service";
import { FxController } from "./fx.controller";
import { FxPort } from "./fx.port";

import type { Env } from "../config/env";

@Global()
@Module({
  controllers: [FxController],
  providers: [
    {
      provide: FxPort,
      useFactory: (config: ConfigService<Env, true>, prisma: PrismaService) =>
        config.get("FX_PROVIDER", { infer: true }) === "mock"
          ? new FxMockService()
          : new FrankfurterFxService(
              prisma,
              new FrankfurterClient(),
              new FxMockService(),
            ),
      inject: [ConfigService, PrismaService],
    },
  ],
  exports: [FxPort],
})
export class FxModule {}
