import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { BrickOpenBankingAdapter } from "./brick-open-banking.adapter";
import { MockOpenBankingAdapter } from "./mock-open-banking.adapter";
import { OpenBankingController } from "./open-banking.controller";
import { OPEN_BANKING_PORT } from "./open-banking.port";

import type { Env } from "../config/env";

@Module({
  imports: [ConfigModule],
  controllers: [OpenBankingController],
  providers: [
    {
      provide: OPEN_BANKING_PORT,
      useFactory: (config: ConfigService<Env, true>) => {
        const clientId = config.get("BRICK_CLIENT_ID", { infer: true });
        const clientSecret = config.get("BRICK_CLIENT_SECRET", { infer: true });
        if (clientId && clientSecret) {
          return new BrickOpenBankingAdapter(clientId, clientSecret);
        }
        return new MockOpenBankingAdapter();
      },
      inject: [ConfigService],
    },
  ],
  exports: [OPEN_BANKING_PORT],
})
export class OpenBankingModule {}
