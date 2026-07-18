import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { Job } from "bullmq";

const MONTHS_BY_PERIOD: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

/** Advance a date by whole months, repeating until it's in the future. */
function advanceUntilFuture(date: Date, months: number, now: Date): Date {
  const next = new Date(date);
  while (next.getTime() <= now.getTime()) {
    next.setMonth(next.getMonth() + months);
  }
  return next;
}

@Processor("billing-cycle")
export class BillingCycleProcessor extends WorkerHost {
  private readonly logger = new Logger(BillingCycleProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(_job: Job): Promise<void> {
    const now = new Date();

    const liabilities = await this.prisma.liability.findMany({
      where: { autoAdvanceDueDate: true, dueDate: { lt: now } },
      select: { id: true, dueDate: true },
    });
    for (const l of liabilities) {
      if (!l.dueDate) continue;
      const nextDueDate = advanceUntilFuture(l.dueDate, 1, now);
      await this.prisma.liability.update({
        where: { id: l.id },
        data: { dueDate: nextDueDate },
      });
      this.logger.log(
        `Advanced liability ${l.id} dueDate to ${nextDueDate.toISOString()}`,
      );
    }

    const insurances = await this.prisma.insurance.findMany({
      where: { autoRenewDate: true, renewalDate: { lt: now } },
      select: { id: true, renewalDate: true, premiumPeriod: true },
    });
    for (const ins of insurances) {
      if (!ins.renewalDate) continue;
      const months = MONTHS_BY_PERIOD[ins.premiumPeriod] ?? 1;
      const nextRenewalDate = advanceUntilFuture(ins.renewalDate, months, now);
      await this.prisma.insurance.update({
        where: { id: ins.id },
        data: { renewalDate: nextRenewalDate },
      });
      this.logger.log(
        `Advanced insurance ${ins.id} renewalDate to ${nextRenewalDate.toISOString()}`,
      );
    }

    if (liabilities.length === 0 && insurances.length === 0) {
      this.logger.log("No due dates needed advancing");
    }
  }
}
