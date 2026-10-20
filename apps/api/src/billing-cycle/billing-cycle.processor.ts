import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InsuranceDocumentsService } from "../insurances/insurance-documents.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InsuranceRemindersService } from "../insurances/insurance-reminders.service";
import {
  isRecurringPeriod,
  scheduleOptionsFor,
  todayInTimeZone,
  walkPastPaidDues,
} from "../insurances/premium-schedule.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { PremiumPeriod } from "@prisma/client";
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
    private readonly insuranceDocuments: InsuranceDocumentsService,
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
    // due, recurring periods only, never beyond the premium payment end.
    // A missed due is NEVER skipped silently: the schedule moves only over
    // dues that have a payment row; the first unpaid one stays as
    // nextPremiumDueDate, so the policy reads `premiumDueStatus: overdue`
    // and the reminder sweep below sends its one "terlambat" notice. The
    // legacy renewalDate is mirrored (null when the schedule ends).
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
      const next = await this.advancePastPaidDues(ins, today);
      if (next === undefined) continue;
      await this.prisma.insurance.update({
        where: { id: ins.id },
        data: { nextPremiumDueDate: next, renewalDate: next },
      });
      this.logger.log(
        `Advanced insurance ${ins.id} nextPremiumDueDate to ${next?.toISOString().slice(0, 10) ?? "none (schedule ended)"}`,
      );
    }

    // Premium reminders — one per policy per due (deduped), Asia/Jakarta.
    const reminded = await this.reminders.sweep(now);
    if (reminded > 0) this.logger.log(`Sent ${reminded} premium reminder(s)`);

    // Policy documents whose row is gone (rollback image cascade, family
    // delete, failed storage delete). Best-effort: never fails the tick.
    await this.insuranceDocuments.sweepOrphans().catch((err: unknown) => {
      this.logger.warn(
        `insurance document orphan sweep failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    });

    if (liabilities.length === 0 && insurances.length === 0) {
      this.logger.log("No due dates needed advancing");
    }
  }

  /** New next due after walking over paid past dues; undefined = unchanged. */
  private async advancePastPaidDues(
    ins: {
      id: string;
      nextPremiumDueDate: Date | null;
      premiumPeriod: PremiumPeriod;
      coverageStartDate: Date | null;
      premiumPaymentEndDate: Date | null;
    },
    today: Date,
  ): Promise<Date | null | undefined> {
    const start = ins.nextPremiumDueDate!;
    const payments = await this.prisma.insurancePayment.findMany({
      where: { insuranceId: ins.id },
      select: { dueDate: true, paidAt: true },
    });
    const { next, moved } = walkPastPaidDues(
      start,
      ins.premiumPeriod,
      scheduleOptionsFor(ins, start),
      payments,
      today,
    );
    return moved ? next : undefined;
  }
}
