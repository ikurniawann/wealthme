import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

import { RedisService } from "./redis.service";

import type { Env } from "../config/env";

export const REDIS_CLIENT = "REDIS_CLIENT";

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
          process.stderr.write(`[Redis] connection error: ${String(err)}\n`);
        });
        return client;
      },
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule {}
