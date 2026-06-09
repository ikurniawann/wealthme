import { Injectable, Logger } from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { CreateAuditLogDto } from "./dto/create-audit-log.dto";
import type { Prisma } from "@prisma/client";

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(dto: CreateAuditLogDto): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: dto.userId,
          familyGroupId: dto.familyGroupId,
          action: dto.action,
          entity: dto.entity,
          entityId: dto.entityId,
          before: dto.before as Prisma.InputJsonValue | undefined,
          after: dto.after as Prisma.InputJsonValue | undefined,
          ipAddress: dto.ipAddress,
          userAgent: dto.userAgent,
        },
      });
    } catch (error: unknown) {
      this.logger.error("Failed to write audit log", {
        error: error instanceof Error ? error.message : String(error),
        dto: { action: dto.action, entity: dto.entity, userId: dto.userId },
      });
    }
  }
}
