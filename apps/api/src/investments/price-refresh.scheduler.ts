import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";

import type { Queue } from "bullmq";

const PRICE_REFRESH_INTERVAL_MS = 60_000;
const JOB_NAME = "refresh-all";

@Injectable()
export class PriceRefreshScheduler {
  private readonly logger = new Logger(PriceRefreshScheduler.name);

  constructor(@InjectQueue("price-refresh") private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      JOB_NAME,
      {},
      {
        repeat: { every: PRICE_REFRESH_INTERVAL_MS },
        jobId: "price-refresh-cron",
      },
    );
    this.logger.log(
      `Scheduled price refresh every ${PRICE_REFRESH_INTERVAL_MS / 1000}s`,
    );
  }
}
