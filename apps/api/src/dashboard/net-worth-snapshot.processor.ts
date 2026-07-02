import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DashboardService } from "./dashboard.service";

import type { Job } from "bullmq";

@Processor("net-worth-snapshot")
export class NetWorthSnapshotProcessor extends WorkerHost {
  private readonly logger = new Logger(NetWorthSnapshotProcessor.name);

  constructor(private readonly dashboard: DashboardService) {
    super();
  }

  async process(_job: Job): Promise<void> {
    const written = await this.dashboard.captureAllSnapshots();
    this.logger.log(`Captured ${written} net-worth snapshot(s)`);
  }
}
