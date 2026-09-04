// eslint-disable-next-line import/order -- must load before NestJS modules resolve
import * as dotenv from "dotenv";

import * as path from "path";

// Must load before any NestJS module resolves so ConfigModule gets test vars.
dotenv.config({
  path: path.resolve(__dirname, "../../../.env.test"),
  override: true,
});

import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ThrottlerGuard, ThrottlerStorage } from "@nestjs/throttler";

import { AppModule } from "../../../src/app.module";
import { PrismaService } from "../../../src/prisma/prisma.service";
// The token lives in redis.constants.ts; redis.module.ts only imports it and
// never re-exports, so this used to resolve to `undefined` at runtime and
// `app.get(undefined)` threw before a single e2e assertion ran.
import { REDIS_CLIENT } from "../../../src/redis/redis.constants";

import type Redis from "ioredis";

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
  redis: Redis;
}

export async function createTestApp(): Promise<TestApp> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    // `overrideGuard` alone never reached the real limiter: it is bound both
    // as `{ provide: APP_GUARD, useClass: ThrottlerGuard }` and as a
    // controller-level `@UseGuards(ThrottlerGuard)` (auth, ai-advisor,
    // open-banking), and neither instance comes from the overridden provider.
    // The suite therefore ran against production limits — 3 registrations and
    // 5 logins per minute — and burned through them in the first spec, so
    // every later request came back 429. A 429 from /auth/login is
    // indistinguishable from a wrong password at the assertion level, which
    // is why this read as "17 auth/RBAC failures" rather than "rate limited".
    // Neutralising the STORAGE is registration-agnostic: every ThrottlerGuard
    // instance, however it was constructed, asks this for the hit count.
    .overrideProvider(ThrottlerStorage)
    .useValue({
      increment: () =>
        Promise.resolve({
          totalHits: 1,
          timeToExpire: 60,
          isBlocked: false,
          timeToBlockExpire: 0,
        }),
    })
    .compile();

  const app = moduleFixture.createNestApplication();

  // Replicate main.ts: ValidationPipe is registered here, not in AppModule.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.init();

  return {
    app,
    prisma: app.get(PrismaService),
    redis: app.get<Redis>(REDIS_CLIENT),
  };
}
