import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";

import type { Queue } from "bullmq";

const BILLING_CYCLE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const JOB_NAME = "advance-due-dates";

@Injectable()
export class BillingCycleScheduler {
  private readonly logger = new Logger(BillingCycleScheduler.name);

  constructor(@InjectQueue("billing-cycle") private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      JOB_NAME,
      {},
      {
        repeat: { every: BILLING_CYCLE_INTERVAL_MS },
        jobId: "billing-cycle-cron",
      },
    );
    this.logger.log(
      `Scheduled due-date auto-advance every ${BILLING_CYCLE_INTERVAL_MS / 1000}s`,
    );
  }
}
