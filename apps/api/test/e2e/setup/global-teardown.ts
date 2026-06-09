import * as path from "path";

import * as dotenv from "dotenv";
import Redis from "ioredis";

export default async function globalTeardown(): Promise<void> {
  dotenv.config({
    path: path.resolve(__dirname, "../../../.env.test"),
    override: true,
  });

  const redisUrl = process.env["REDIS_URL"];
  if (!redisUrl) return;

  const redis = new Redis(redisUrl);
  await redis.flushdb();
  await redis.quit();
}
