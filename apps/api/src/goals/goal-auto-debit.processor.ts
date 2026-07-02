import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { GoalsService } from "./goals.service";

import type { Job } from "bullmq";

@Processor("goal-auto-debit")
export class GoalAutoDebitProcessor extends WorkerHost {
  private readonly logger = new Logger(GoalAutoDebitProcessor.name);

  constructor(private readonly goals: GoalsService) {
    super();
  }

  async process(_job: Job): Promise<void> {
    const debited = await this.goals.runAutoDebit();
    this.logger.log(`Auto-debited ${debited} goal(s)`);
  }
}
