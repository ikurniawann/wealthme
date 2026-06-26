import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { type CoaBudgetType, type CoaDirection, Prisma } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

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
    try {
      const row = await this.prisma.coaAccount.create({
        data: {
          familyGroupId,
          code: dto.code,
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
          `COA account with code "${dto.code}" already exists for this family group`,
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

    const row = await this.prisma.coaAccount.update({
      where: { id, familyGroupId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.groupNum !== undefined && { groupNum: dto.groupNum }),
        ...(dto.direction !== undefined && { direction: dto.direction }),
        ...(dto.budgetType !== undefined && { budgetType: dto.budgetType }),
        ...(dto.parentCode !== undefined && { parentCode: dto.parentCode }),
      },
    });
    return this.toDto(row);
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
