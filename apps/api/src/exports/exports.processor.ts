import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { EXPORT_QUEUE, ExportsService } from "./exports.service";

import type { ExportJobData } from "./exports.service";
import type { Job } from "bullmq";

@Processor(EXPORT_QUEUE)
export class ExportsProcessor extends WorkerHost {
  private readonly logger = new Logger(ExportsProcessor.name);

  constructor(private readonly exportsService: ExportsService) {
    super();
  }

  async process(job: Job<ExportJobData>): Promise<void> {
    if (!job.id) throw new Error("Job has no id");
    const jobId = job.id;
    const { familyGroupId, request } = job.data;

    this.logger.log(
      `Processing export job ${jobId} (${request.type}/${request.format})`,
    );
    this.exportsService.markProcessing(jobId);

    try {
      const dataUrl = await this.exportsService.generate(
        familyGroupId,
        request,
      );
      this.exportsService.markDone(jobId, dataUrl);
      this.logger.log(`Export job ${jobId} completed`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Export job ${jobId} failed: ${message}`);
      this.exportsService.markFailed(jobId, message);
      throw err;
    }
  }
}
