import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { MemberCategoryAllowanceResponseDto } from "./dto/member-category-allowance-response.dto";
import type { SetMemberCategoryAllowanceDto } from "./dto/set-member-category-allowance.dto";

// EPIC-019 Task C — owner-managed per-member expense category allow-list.
// Zero rows = unrestricted; this is the default for every pre-existing
// member, so nothing changes until an owner explicitly sets a list.
@Injectable()
export class MemberCategoryAllowancesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    familyGroupId: string,
    memberId: string,
  ): Promise<MemberCategoryAllowanceResponseDto> {
    await this.assertMemberInGroup(familyGroupId, memberId);

    const rows = await this.prisma.memberCategoryAllowance.findMany({
      where: { memberId },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });

    return {
      memberId,
      categories: rows.map((r) => ({
        id: r.category.id,
        name: r.category.name,
      })),
    };
  }

  async replace(
    familyGroupId: string,
    memberId: string,
    dto: SetMemberCategoryAllowanceDto,
  ): Promise<MemberCategoryAllowanceResponseDto> {
    await this.assertMemberInGroup(familyGroupId, memberId);

    const categoryIds = Array.from(new Set(dto.categoryIds));
    if (categoryIds.length > 0) {
      // Only expense categories in the SAME family group are valid — rejects
      // cross-tenant ids and income categories (the allow-list only ever
      // constrains expense transactions, see transactions.service.ts).
      const count = await this.prisma.category.count({
        where: { familyGroupId, id: { in: categoryIds }, kind: "expense" },
      });
      if (count !== categoryIds.length) {
        throw new BadRequestException(
          "One or more categoryIds are invalid for this family group (must be an expense category)",
        );
      }
    }

    await this.prisma.$transaction([
      this.prisma.memberCategoryAllowance.deleteMany({ where: { memberId } }),
      ...(categoryIds.length > 0
        ? [
            this.prisma.memberCategoryAllowance.createMany({
              data: categoryIds.map((categoryId) => ({ memberId, categoryId })),
            }),
          ]
        : []),
    ]);

    return this.findAll(familyGroupId, memberId);
  }

  private async assertMemberInGroup(
    familyGroupId: string,
    memberId: string,
  ): Promise<void> {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, familyGroupId },
      select: { id: true },
    });
    if (!member) {
      throw new NotFoundException("Member not found in this family group");
    }
  }
}
