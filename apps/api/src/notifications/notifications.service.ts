import { Injectable } from "@nestjs/common";

import { isRowScopedRole } from "../common/utils/privacy.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { MarkReadDto } from "./dto/mark-read.dto";
import type { Prisma, Role } from "@prisma/client";

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
  role: Role | null | undefined,
): Prisma.NotificationWhereInput {
  if (isRowScopedRole(role)) {
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
    role: Role | null | undefined,
  ): Promise<NotificationDto[]> {
    const rows = await this.prisma.notification.findMany({
      where: visibilityWhere(familyGroupId, viewerUserId, role),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        body: true,
        icon: true,
        isRead: true,
        createdAt: true,
      },
    });

    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async getUnreadCount(
    familyGroupId: string,
    viewerUserId: string,
    role: Role | null | undefined,
  ): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: {
        ...visibilityWhere(familyGroupId, viewerUserId, role),
        isRead: false,
      },
    });
    return { count };
  }

  async markRead(
    familyGroupId: string,
    viewerUserId: string,
    role: Role | null | undefined,
    dto: MarkReadDto,
  ): Promise<{ updated: number }> {
    // The visibility clause is what stops "mark all read" from reaching rows
    // the caller cannot see — including, for a row-scoped role, every
    // household row in the family.
    const visible = visibilityWhere(familyGroupId, viewerUserId, role);

    if (dto.ids && dto.ids.length > 0) {
      const result = await this.prisma.notification.updateMany({
        where: { ...visible, id: { in: dto.ids }, isRead: false },
        data: { isRead: true },
      });
      return { updated: result.count };
    }

    const result = await this.prisma.notification.updateMany({
      where: { ...visible, isRead: false },
      data: { isRead: true },
    });
    return { updated: result.count };
  }
}
