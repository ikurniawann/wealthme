import { Injectable, Logger } from "@nestjs/common";
import {
  Prisma,
  type InsuranceStatus,
  type PremiumPeriod,
} from "@prisma/client";

import { ownerNotifPrefs } from "../notifications/notification-prefs";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import {
  daysBetween,
  dueNeedsConfirmation,
  reminderWindowDays,
  todayInTimeZone,
  ymd,
} from "./premium-schedule.util";

/** Statuses whose premiums are still being collected. */
export const PREMIUM_PAYING_STATUSES: readonly InsuranceStatus[] = [
  "aktif",
  "masa_tenggang",
];

export interface ReminderPolicy {
  id: string;
  familyGroupId: string;
  name: string;
  status: InsuranceStatus;
  premiumPeriod: PremiumPeriod;
  nextPremiumDueDate: Date | null;
  holderUserId: string | null;
  payerUserId: string | null;
}

const REMINDER_SELECT = {
  id: true,
  familyGroupId: true,
  name: true,
  status: true,
  premiumPeriod: true,
  nextPremiumDueDate: true,
  holderUserId: true,
  payerUserId: true,
} as const;

/**
 * Asuransi Task 22 — premium reminders, ONLY from the premium schedule
 * (nextPremiumDueDate), never from coverage end or policy renewal.
 *
 * - One reminder per policy per due date: the `insurance_premium_reminders`
 *   unique (insuranceId, dueDate) row is claimed in the same transaction as
 *   the notification, so a retry, a second PATCH or a second worker tick
 *   can never notify twice for the same due.
 * - "Today" is the Asia/Jakarta calendar day (no per-user time zone exists
 *   yet; DEFAULT_TIME_ZONE).
 * - Window: 7 days ahead for monthly premiums, 30 days otherwise; an
 *   already-overdue due that was never reminded gets one "terlambat" notice.
 * - Addressed to the payer (else the holder) when that is a member, so a
 *   policy scoped to them (S9) is not announced household-wide; otherwise a
 *   household notification as before.
 */
@Injectable()
export class InsuranceRemindersService {
  private readonly logger = new Logger(InsuranceRemindersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Best-effort: never fails the caller. Returns true when a reminder was created. */
  async remindIfDue(
    policy: ReminderPolicy,
    now: Date = new Date(),
  ): Promise<boolean> {
    try {
      return await this.remind(policy, todayInTimeZone(now));
    } catch (err: unknown) {
      this.logger.warn(
        `premium reminder failed for insurance ${policy.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  /** Daily sweep (billing-cycle worker): every due inside its window. */
  async sweep(now: Date = new Date()): Promise<number> {
    const today = todayInTimeZone(now);
    const horizon = new Date(today.getTime() + 30 * 86_400_000);
    const policies = await this.prisma.insurance.findMany({
      where: {
        status: { in: [...PREMIUM_PAYING_STATUSES] },
        nextPremiumDueDate: { not: null, lte: horizon },
      },
      select: REMINDER_SELECT,
    });
    let sent = 0;
    for (const p of policies) {
      if (await this.remindIfDue(p, now)) sent++;
    }
    return sent;
  }

  private async remind(policy: ReminderPolicy, today: Date): Promise<boolean> {
    const due = policy.nextPremiumDueDate;
    if (!due || !PREMIUM_PAYING_STATUSES.includes(policy.status)) return false;
    // A legacy due that looks like a coverage end is never reminded.
    if (dueNeedsConfirmation(policy, today)) return false;
    const days = daysBetween(today, due);
    if (days > reminderWindowDays(policy.premiumPeriod)) return false;

    const prefs = await ownerNotifPrefs(this.prisma, policy.familyGroupId);
    if (!prefs.billDue) return false;

    const recipient = policy.payerUserId ?? policy.holderUserId;
    const dueText = ymd(due);
    const body =
      days < 0
        ? `Premi ${policy.name} jatuh tempo ${dueText} — terlambat ${-days} hari`
        : days === 0
          ? `Premi ${policy.name} jatuh tempo hari ini (${dueText})`
          : `Premi ${policy.name} jatuh tempo ${dueText} (${days} hari lagi)`;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.insurancePremiumReminder.create({
          data: { insuranceId: policy.id, dueDate: due },
        });
        await tx.notification.create({
          data: {
            familyGroupId: policy.familyGroupId,
            userId: recipient,
            title: "Premi Asuransi Jatuh Tempo",
            body,
            icon: "🛡️",
          },
        });
      });
      return true;
    } catch (err: unknown) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return false; // already reminded for this due
      }
      throw err;
    }
  }
}
