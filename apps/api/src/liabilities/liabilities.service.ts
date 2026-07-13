import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { CreateLiabilityDto } from "./dto/create-liability.dto";
import type {
  LiabilityResponseDto,
  LiabilitySummaryResponseDto,
} from "./dto/liability-response.dto";
import type { UpdateLiabilityDto } from "./dto/update-liability.dto";

function toLiabilityDto(liability: {
  id: string;
  familyGroupId: string;
  name: string;
  institution: string | null;
  type: string;
  totalDebt: bigint;
  remainingBalance: bigint;
  minimumPayment: bigint;
  interestRate: { toString(): string };
  dueDate: Date | null;
  autoAdvanceDueDate: boolean;
  notes: string | null;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}): LiabilityResponseDto {
  const paymentRatio =
    liability.totalDebt > BigInt(0)
      ? Number(
          ((liability.totalDebt - liability.remainingBalance) * BigInt(100) +
            liability.totalDebt / BigInt(2)) /
            liability.totalDebt,
        )
      : 0;

  return {
    id: liability.id,
    familyGroupId: liability.familyGroupId,
    name: liability.name,
    institution: liability.institution,
    type: liability.type,
    totalDebt: liability.totalDebt.toString(),
    remainingBalance: liability.remainingBalance.toString(),
    minimumPayment: liability.minimumPayment.toString(),
    interestRate: liability.interestRate.toString(),
    dueDate: liability.dueDate?.toISOString() ?? null,
    autoAdvanceDueDate: liability.autoAdvanceDueDate,
    paymentRatio,
    notes: liability.notes,
    currency: liability.currency,
    createdAt: liability.createdAt.toISOString(),
    updatedAt: liability.updatedAt.toISOString(),
  };
}

function guardBigInt(field: string, value: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new BadRequestException(
      `${field} must be a non-negative integer string`,
    );
  }
  return BigInt(value);
}

@Injectable()
export class LiabilitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(familyGroupId: string): Promise<LiabilityResponseDto[]> {
    const liabilities = await this.prisma.liability.findMany({
      where: { familyGroupId },
      orderBy: { createdAt: "asc" },
    });
    return liabilities.map(toLiabilityDto);
  }

  async getSummary(
    familyGroupId: string,
  ): Promise<LiabilitySummaryResponseDto> {
    const liabilities = await this.prisma.liability.findMany({
      where: { familyGroupId },
      select: { totalDebt: true, remainingBalance: true },
    });

    const totalRemainingBalance = liabilities.reduce(
      (sum, l) => sum + l.remainingBalance,
      BigInt(0),
    );
    const totalDebt = liabilities.reduce(
      (sum, l) => sum + l.totalDebt,
      BigInt(0),
    );

    return {
      totalRemainingBalance: totalRemainingBalance.toString(),
      totalDebt: totalDebt.toString(),
      currency: "IDR",
    };
  }

  async create(
    familyGroupId: string,
    dto: CreateLiabilityDto,
  ): Promise<LiabilityResponseDto> {
    const totalDebt = guardBigInt("totalDebt", dto.totalDebt);
    const remainingBalance = guardBigInt(
      "remainingBalance",
      dto.remainingBalance,
    );
    const minimumPayment = dto.minimumPayment
      ? guardBigInt("minimumPayment", dto.minimumPayment)
      : BigInt(0);

    const liability = await this.prisma.liability.create({
      data: {
        familyGroupId,
        name: dto.name,
        institution: dto.institution ?? null,
        type: dto.type,
        totalDebt,
        remainingBalance,
        minimumPayment,
        interestRate: dto.interestRate ?? "0",
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        autoAdvanceDueDate: dto.autoAdvanceDueDate ?? false,
        notes: dto.notes ?? null,
        currency: dto.currency ?? "IDR",
      },
    });

    return toLiabilityDto(liability);
  }

  async update(
    familyGroupId: string,
    id: string,
    dto: UpdateLiabilityDto,
  ): Promise<LiabilityResponseDto> {
    const existing = await this.prisma.liability.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) {
      throw new NotFoundException("Liability not found");
    }

    const totalDebt = dto.totalDebt
      ? guardBigInt("totalDebt", dto.totalDebt)
      : existing.totalDebt;
    const remainingBalance = dto.remainingBalance
      ? guardBigInt("remainingBalance", dto.remainingBalance)
      : existing.remainingBalance;
    const minimumPayment = dto.minimumPayment
      ? guardBigInt("minimumPayment", dto.minimumPayment)
      : existing.minimumPayment;

    const updated = await this.prisma.liability.update({
      where: { id, familyGroupId },
      data: {
        name: dto.name ?? existing.name,
        institution:
          dto.institution !== undefined
            ? (dto.institution ?? null)
            : existing.institution,
        type: dto.type ?? existing.type,
        totalDebt,
        remainingBalance,
        minimumPayment,
        interestRate: dto.interestRate ?? existing.interestRate,
        dueDate:
          dto.dueDate !== undefined
            ? dto.dueDate
              ? new Date(dto.dueDate)
              : null
            : existing.dueDate,
        autoAdvanceDueDate:
          dto.autoAdvanceDueDate ?? existing.autoAdvanceDueDate,
        notes: dto.notes !== undefined ? (dto.notes ?? null) : existing.notes,
        currency: dto.currency ?? existing.currency,
      },
    });

    return toLiabilityDto(updated);
  }

  async remove(familyGroupId: string, id: string): Promise<void> {
    const existing = await this.prisma.liability.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) {
      throw new NotFoundException("Liability not found");
    }
    await this.prisma.liability.delete({ where: { id, familyGroupId } });
  }
}
