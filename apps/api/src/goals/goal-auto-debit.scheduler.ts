import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";

import type { Queue } from "bullmq";

const JOB_NAME = "run-auto-debit";
// Monthly on the 1st at 03:00 — after the nightly snapshot. Fixed jobId keeps
// this a single repeatable cron.
const AUTO_DEBIT_CRON = "0 3 1 * *";

@Injectable()
export class GoalAutoDebitScheduler {
  private readonly logger = new Logger(GoalAutoDebitScheduler.name);

  constructor(@InjectQueue("goal-auto-debit") private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      JOB_NAME,
      {},
      {
        repeat: { pattern: AUTO_DEBIT_CRON },
        jobId: "goal-auto-debit-cron",
      },
    );
    this.logger.log(`Scheduled monthly goal auto-debit (${AUTO_DEBIT_CRON})`);
  }
}
