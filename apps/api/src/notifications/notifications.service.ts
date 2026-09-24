import { Injectable } from "@nestjs/common";

import { isRowScoped, type ScopeSubject } from "../common/utils/privacy.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

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

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    familyGroupId: string,
    viewerUserId: string,
    role: ScopeSubject,
  ): Promise<NotificationDto[]> {
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
