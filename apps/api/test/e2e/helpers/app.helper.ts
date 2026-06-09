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
import { ThrottlerGuard } from "@nestjs/throttler";

import { AppModule } from "../../../src/app.module";
import { PrismaService } from "../../../src/prisma/prisma.service";
import { REDIS_CLIENT } from "../../../src/redis/redis.module";

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
