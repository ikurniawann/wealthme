import { Injectable } from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { MarkReadDto } from "./dto/mark-read.dto";

type NotificationDto = {
  id: string;
  title: string;
  body: string;
  icon: string | null;
  isRead: boolean;
  createdAt: string;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(familyGroupId: string): Promise<NotificationDto[]> {
    const rows = await this.prisma.notification.findMany({
      where: { familyGroupId },
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

  async getUnreadCount(familyGroupId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { familyGroupId, isRead: false },
    });
    return { count };
  }

  async markRead(
    familyGroupId: string,
    dto: MarkReadDto,
  ): Promise<{ updated: number }> {
    if (dto.ids && dto.ids.length > 0) {
      const result = await this.prisma.notification.updateMany({
        where: { familyGroupId, id: { in: dto.ids }, isRead: false },
        data: { isRead: true },
      });
      return { updated: result.count };
    }

    const result = await this.prisma.notification.updateMany({
      where: { familyGroupId, isRead: false },
      data: { isRead: true },
    });
    return { updated: result.count };
  }
}
