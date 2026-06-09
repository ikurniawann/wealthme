import { Global, Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

import { REDIS_CLIENT } from "./redis.constants";
import { RedisService } from "./redis.service";

import type { Env } from "../config/env";

const logger = new Logger("RedisModule");

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const client = new Redis(config.get("REDIS_URL", { infer: true }));
        client.on("error", (err: unknown) => {
          // ioredis emits errors on disconnect; log but let NestJS lifecycle handle shutdown
          logger.error(
            `connection error: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
        return client;
      },
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule {}
