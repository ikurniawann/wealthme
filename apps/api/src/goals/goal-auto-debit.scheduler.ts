import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";

import type { Queue } from "bullmq";

const JOB_NAME = "run-auto-debit";
const JOB_ID = "goal-auto-debit-cron";
// Daily at 03:00, after the 02:00 net-worth snapshot; the service picks goals due today.
export const AUTO_DEBIT_CRON = "0 3 * * *";

@Injectable()
export class GoalAutoDebitScheduler {
  private readonly logger = new Logger(GoalAutoDebitScheduler.name);

  constructor(@InjectQueue("goal-auto-debit") private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    // A repeatable's key includes its pattern, so the old monthly cron would keep firing unless removed.
    const repeatables = await this.queue.getRepeatableJobs();
    for (const job of repeatables) {
      if (job.name === JOB_NAME && job.pattern !== AUTO_DEBIT_CRON) {
        await this.queue.removeRepeatableByKey(job.key);
      }
    }
    await this.queue.add(
      JOB_NAME,
      {},
      { repeat: { pattern: AUTO_DEBIT_CRON }, jobId: JOB_ID },
    );
    this.logger.log(`Scheduled daily goal auto-debit (${AUTO_DEBIT_CRON})`);
  }
}
