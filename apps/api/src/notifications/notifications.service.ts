import { Injectable, Logger } from "@nestjs/common";
import { daysBetween, isoDate, nextMaturityDate } from "@wealthme/contracts";

import { isRowScoped, type ScopeSubject } from "../common/utils/privacy.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import { ownerNotifPrefs } from "./notification-prefs";

import type { MarkReadDto } from "./dto/mark-read.dto";
import type { Prisma } from "@prisma/client";

type NotificationDto = {
  id: string;
  title: string;
  body: string;
  icon: string | null;
  isRead: boolean;
  createdAt: string;
};

/**
 * Who may see which notification.
 *
 * Every query in this service goes through here, so the list, the unread
 * badge, and mark-read can never disagree about visibility — a mismatch would
 * show a badge count for rows the list refuses to render, or let mark-read
 * clear something the caller cannot see.
 *
 *  - **Row-scoped roles** (`dependant`/`operational`) see ONLY rows addressed
 *    to them. Household rows (`userId: null`) carry whole-family figures —
 *    net-worth goals, KPR due dates, budget thresholds, and other members'
 *    funding requests — the exact surface `assertHouseholdWideReadAllowed`
 *    denies these roles everywhere else. Before targeting existed they were
 *    simply refused the endpoint outright (403), which is why a child never
 *    learned their own funding request had been approved.
 *  - **Every other role** sees household rows plus their own. Another
 *    member's targeted row is not theirs to read: an owner who approves a
 *    request already knows the outcome, and does not need a copy of the
 *    child's "your request was approved".
 */
function visibilityWhere(
  familyGroupId: string,
  viewerUserId: string,
  role: ScopeSubject,
): Prisma.NotificationWhereInput {
  // EPIC-030 — effective data scope (a Master-customised role), not just the
  // built-in type.
  if (isRowScoped(role)) {
    return { familyGroupId, userId: viewerUserId };
  }
  return {
    familyGroupId,
    OR: [{ userId: null }, { userId: viewerUserId }],
  };
}

/** Days before a deposit matures that its reminder appears. */
export const DEPOSIT_REMINDER_DAYS = 7;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Rekening v3 — "Ingatkan 7 hari sebelum jatuh tempo". There is no job
   * scheduler in this app, so the reminder is raised lazily: whenever a
   * member opens the bell (list or unread badge), every opted-in deposit
   * maturing within DEPOSIT_REMINDER_DAYS gets one notification per
   * maturity date. `maturityReminderSentFor` is claimed with a conditional
   * updateMany first, so two concurrent bell loads cannot both create it.
   * A private deposit is addressed only to Master/Co-Master, the roles that
   * may see it. Failures are logged, never thrown: a reminder must not
   * break the notification list itself.
   */
  async raiseDepositMaturityReminders(familyGroupId: string): Promise<void> {
    try {
      const prefs = await ownerNotifPrefs(this.prisma, familyGroupId);
      if (!prefs.billDue) return;
      // Calendar day in Indonesia (WIB, UTC+7): the reminder window must not
      // shift a day between 00:00 and 07:00 local time.
      const today = isoDate(new Date(Date.now() + 7 * 3_600_000));
      const deposits = await this.prisma.account.findMany({
        where: {
          familyGroupId,
          productKind: "time_deposit",
          maturityReminder: true,
          status: { not: "closed" },
          placementDate: { not: null },
          tenorMonths: { not: null },
        },
        select: {
          id: true,
          name: true,
          isPrivate: true,
          placementDate: true,
          tenorMonths: true,
          maturityInstruction: true,
          maturityReminderSentFor: true,
        },
      });
      for (const dep of deposits) {
        const maturity = nextMaturityDate(
          dep.placementDate ? isoDate(dep.placementDate) : null,
          dep.tenorMonths,
          dep.maturityInstruction,
          today,
        );
        if (!maturity) continue;
        const days = daysBetween(today, maturity);
        if (days < 0 || days > DEPOSIT_REMINDER_DAYS) continue;
        const maturityDate = new Date(`${maturity}T00:00:00.000Z`);
        const title = "Deposito segera jatuh tempo";
        const body =
          days === 0
            ? `Deposito ${dep.name} jatuh tempo hari ini (${maturity}).`
            : `Deposito ${dep.name} jatuh tempo ${maturity}, ${days} hari lagi.`;
        const recipients: Array<string | null> = dep.isPrivate
          ? (
              await this.prisma.member.findMany({
                where: { familyGroupId, role: { in: ["owner", "spouse"] } },
                select: { userId: true },
              })
            ).map((m) => m.userId)
          : [null];
        // Claim and notify in one transaction: a failed insert rolls the
        // claim back, so the reminder is retried instead of silently lost.
        await this.prisma.$transaction(async (tx) => {
          const claimed = await tx.account.updateMany({
            where: {
              id: dep.id,
              OR: [
                { maturityReminderSentFor: null },
                { maturityReminderSentFor: { not: maturityDate } },
              ],
            },
            data: { maturityReminderSentFor: maturityDate },
          });
          if (claimed.count !== 1) return;
          await tx.notification.createMany({
            data: recipients.map((userId) => ({
              familyGroupId,
              userId,
              title,
              body,
              icon: "📅",
            })),
          });
        });
      }
    } catch (err: unknown) {
      this.logger.warn(
        `Deposit maturity reminders failed for ${familyGroupId}: ${String(err)}`,
      );
    }
  }

  async findAll(
    familyGroupId: string,
    viewerUserId: string,
    role: ScopeSubject,
  ): Promise<NotificationDto[]> {
    await this.raiseDepositMaturityReminders(familyGroupId);
    const rows = await this.prisma.notification.findMany({
      where: visibilityWhere(familyGroupId, viewerUserId, role),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        body: true,
        icon: true,
        createdAt: true,
        // Read state is per member: only THIS viewer's receipt counts.
        reads: { where: { userId: viewerUserId }, select: { userId: true } },
      },
    });

    return rows.map(({ reads, ...row }) => ({
      ...row,
      isRead: reads.length > 0,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async getUnreadCount(
    familyGroupId: string,
    viewerUserId: string,
    role: ScopeSubject,
  ): Promise<{ count: number }> {
    await this.raiseDepositMaturityReminders(familyGroupId);
    const count = await this.prisma.notification.count({
      where: {
        ...visibilityWhere(familyGroupId, viewerUserId, role),
        reads: { none: { userId: viewerUserId } },
      },
    });
    return { count };
  }

  /**
   * Marks notifications read FOR THE CALLER ONLY (a NotificationRead
   * receipt), so a household notification one member has read stays unread
   * for the others. `ids` narrows to specific rows; omitted = everything
   * unread. The visibility clause is what stops either form from reaching
   * rows the caller cannot see — including, for a row-scoped role, every
   * household row in the family.
   */
  async markRead(
    familyGroupId: string,
    viewerUserId: string,
    role: ScopeSubject,
    dto: MarkReadDto,
  ): Promise<{ updated: number }> {
    const unread = await this.prisma.notification.findMany({
      where: {
        ...visibilityWhere(familyGroupId, viewerUserId, role),
        reads: { none: { userId: viewerUserId } },
        ...(dto.ids && dto.ids.length > 0 ? { id: { in: dto.ids } } : {}),
      },
      select: { id: true },
    });
    if (unread.length === 0) return { updated: 0 };

    const result = await this.prisma.notificationRead.createMany({
      data: unread.map((n) => ({
        notificationId: n.id,
        userId: viewerUserId,
      })),
      skipDuplicates: true,
    });
    return { updated: result.count };
  }
}
