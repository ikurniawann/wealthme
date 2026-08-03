import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { type CoaBudgetType, type CoaDirection, Prisma } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import { assertValidCoaCode, nextFreeCoaCode } from "./coa-code.util";

import type { CoaAccountResponseDto } from "./dto/coa-account-response.dto";
import type { CreateCoaAccountDto } from "./dto/create-coa-account.dto";
import type { UpdateCoaAccountDto } from "./dto/update-coa-account.dto";

@Injectable()
export class CoaAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(familyGroupId: string): Promise<CoaAccountResponseDto[]> {
    const rows = await this.prisma.coaAccount.findMany({
      where: { familyGroupId },
      orderBy: [{ groupNum: "asc" }, { code: "asc" }],
    });
    return rows.map((r) => this.toDto(r));
  }

  async create(
    familyGroupId: string,
    dto: CreateCoaAccountDto,
  ): Promise<CoaAccountResponseDto> {
    const code = await this.resolveCreateCode(familyGroupId, dto);
    try {
      const row = await this.prisma.coaAccount.create({
        data: {
          familyGroupId,
          code,
          name: dto.name,
          groupNum: dto.groupNum,
          direction: dto.direction,
          budgetType: dto.budgetType ?? null,
          parentCode: dto.parentCode ?? null,
        },
      });
      return this.toDto(row);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ConflictException(
          `COA account with code "${code}" already exists for this family group`,
        );
      }
      throw err;
    }
  }

  async update(
    familyGroupId: string,
    id: string,
    dto: UpdateCoaAccountDto,
  ): Promise<CoaAccountResponseDto> {
    const existing = await this.prisma.coaAccount.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) throw new NotFoundException("COA account not found");

    const nextCode = this.resolveUpdateCode(existing, dto);

    try {
      const row = await this.prisma.coaAccount.update({
        where: { id, familyGroupId },
        data: {
          ...(nextCode !== undefined && { code: nextCode }),
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.groupNum !== undefined && { groupNum: dto.groupNum }),
          ...(dto.direction !== undefined && { direction: dto.direction }),
          ...(dto.budgetType !== undefined && { budgetType: dto.budgetType }),
          ...(dto.parentCode !== undefined && { parentCode: dto.parentCode }),
        },
      });
      return this.toDto(row);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ConflictException(
          `COA account with code "${nextCode}" already exists for this family group`,
        );
      }
      throw err;
    }
  }

  /**
   * EPIC-021 #4 — resolve the code for a new COA account: use the caller's
   * code (validated against the group-prefix invariant), or auto-generate
   * the next free one within the group's range when omitted/blank.
   */
  private async resolveCreateCode(
    familyGroupId: string,
    dto: CreateCoaAccountDto,
  ): Promise<string> {
    const trimmed = dto.code?.trim();
    if (trimmed) {
      assertValidCoaCode(trimmed, dto.groupNum);
      return trimmed;
    }
    const siblings = await this.prisma.coaAccount.findMany({
      where: { familyGroupId, groupNum: dto.groupNum },
      select: { code: true },
    });
    return nextFreeCoaCode(
      dto.groupNum,
      siblings.map((s) => s.code),
    );
  }

  /**
   * EPIC-021 #4 / Decision #11 — resolve the code for an update. Returns
   * `undefined` when the code is unchanged. A caller-supplied code is
   * validated against the *effective* groupNum (the new one if it's also
   * changing). If only groupNum changes, the existing code must still
   * satisfy the group-prefix invariant against the new group — the caller
   * must supply a matching new code in that case.
   */
  private resolveUpdateCode(
    existing: { code: string; groupNum: number },
    dto: UpdateCoaAccountDto,
  ): string | undefined {
    const effectiveGroupNum = dto.groupNum ?? existing.groupNum;

    if (dto.code !== undefined) {
      const trimmed = dto.code.trim();
      if (!trimmed) {
        throw new BadRequestException("COA code cannot be blank");
      }
      assertValidCoaCode(trimmed, effectiveGroupNum);
      return trimmed;
    }

    if (dto.groupNum !== undefined) {
      // groupNum is changing without an explicit new code — the existing
      // code must still satisfy the group-prefix invariant.
      assertValidCoaCode(existing.code, effectiveGroupNum);
    }
    return undefined;
  }

  async remove(familyGroupId: string, id: string): Promise<void> {
    const existing = await this.prisma.coaAccount.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) throw new NotFoundException("COA account not found");
    await this.prisma.coaAccount.delete({ where: { id, familyGroupId } });
  }

  private toDto(r: {
    id: string;
    familyGroupId: string;
    code: string;
    name: string;
    groupNum: number;
    direction: CoaDirection;
    budgetType: CoaBudgetType | null;
    parentCode: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): CoaAccountResponseDto {
    return {
      id: r.id,
      familyGroupId: r.familyGroupId,
      code: r.code,
      name: r.name,
      groupNum: r.groupNum,
      direction: r.direction,
      budgetType: r.budgetType,
      parentCode: r.parentCode,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}
