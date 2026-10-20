import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InsuranceRemindersService } from "../insurances/insurance-reminders.service";
import {
  advanceToOnOrAfter,
  isRecurringPeriod,
  scheduleOptionsFor,
  todayInTimeZone,
} from "../insurances/premium-schedule.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { Job } from "bullmq";

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly reminders: InsuranceRemindersService,
  ) {
    super();
  }

  async process(_job: Job): Promise<void> {
    const now = new Date();

    const liabilities = await this.prisma.liability.findMany({
      // `lte` (not `lt`): a due date landing exactly at this worker tick
      // must still be picked up, not skipped until the next run.
      where: { autoAdvanceDueDate: true, dueDate: { lte: now } },
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

    // Asuransi S1 — the premium schedule lives in nextPremiumDueDate. Only
    // policies the user opted into auto-advancing (autoRenewDate) move past a
    // missed due; recurring periods only (single/custom have no step), never
    // beyond the premium payment end. The legacy renewalDate is mirrored
    // during the rollback window.
    const today = todayInTimeZone(now);
    const insurances = await this.prisma.insurance.findMany({
      where: { autoRenewDate: true, nextPremiumDueDate: { lt: today } },
      select: {
        id: true,
        nextPremiumDueDate: true,
        premiumPeriod: true,
        coverageStartDate: true,
        premiumPaymentEndDate: true,
      },
    });
    for (const ins of insurances) {
      if (!ins.nextPremiumDueDate || !isRecurringPeriod(ins.premiumPeriod)) {
        continue;
      }
      const next = advanceToOnOrAfter(
        ins.nextPremiumDueDate,
        ins.premiumPeriod,
        today,
        scheduleOptionsFor(ins),
      );
      await this.prisma.insurance.update({
        where: { id: ins.id },
        data: { nextPremiumDueDate: next, ...(next && { renewalDate: next }) },
      });
      this.logger.log(
        `Advanced insurance ${ins.id} nextPremiumDueDate to ${next?.toISOString().slice(0, 10) ?? "none (schedule ended)"}`,
      );
    }

    // Premium reminders — one per policy per due (deduped), Asia/Jakarta.
    const reminded = await this.reminders.sweep(now);
    if (reminded > 0) this.logger.log(`Sent ${reminded} premium reminder(s)`);

    if (liabilities.length === 0 && insurances.length === 0) {
      this.logger.log("No due dates needed advancing");
    }
  }
}
