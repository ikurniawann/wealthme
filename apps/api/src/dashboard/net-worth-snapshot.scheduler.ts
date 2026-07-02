import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";

import type { Queue } from "bullmq";

const JOB_NAME = "capture-all";
// Daily at 02:00 — a quiet hour. A fixed jobId keeps this a single repeatable cron.
const SNAPSHOT_CRON = "0 2 * * *";

@Injectable()
export class NetWorthSnapshotScheduler {
  private readonly logger = new Logger(NetWorthSnapshotScheduler.name);

  constructor(
    @InjectQueue("net-worth-snapshot") private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      JOB_NAME,
      {},
      {
        repeat: { pattern: SNAPSHOT_CRON },
        jobId: "net-worth-snapshot-cron",
      },
    );
    this.logger.log(`Scheduled daily net-worth snapshot (${SNAPSHOT_CRON})`);
  }
}
