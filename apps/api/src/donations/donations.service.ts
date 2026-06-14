import { Injectable, NotFoundException } from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { CreateDonationDto } from "./dto/create-donation.dto";
import type { DonationResponseDto } from "./dto/donation-response.dto";
import type { UpdateDonationDto } from "./dto/update-donation.dto";

type DonationRow = {
  id: string;
  familyGroupId: string;
  type: string;
  recipient: string;
  amount: bigint;
  currency: string;
  donatedAt: Date;
  isTaxDeductible: boolean;
  receiptUrl: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toDonationDto(row: DonationRow): DonationResponseDto {
  return {
    id: row.id,
    familyGroupId: row.familyGroupId,
    type: row.type,
    recipient: row.recipient,
    amount: row.amount.toString(),
    currency: row.currency,
    donatedAt: row.donatedAt.toISOString(),
    isTaxDeductible: row.isTaxDeductible,
    receiptUrl: row.receiptUrl,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class DonationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    familyGroupId: string,
    year?: number,
  ): Promise<DonationResponseDto[]> {
    const where: Record<string, unknown> = { familyGroupId };
    if (year !== undefined) {
      where["donatedAt"] = {
        gte: new Date(`${year}-01-01T00:00:00.000Z`),
        lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
      };
    }
    const rows = await this.prisma.donation.findMany({
      where,
      orderBy: { donatedAt: "desc" },
    });
    return rows.map(toDonationDto);
  }

  async findOne(
    familyGroupId: string,
    id: string,
  ): Promise<DonationResponseDto> {
    const row = await this.prisma.donation.findUnique({
      where: { id, familyGroupId },
    });
    if (!row) throw new NotFoundException("Donation not found");
    return toDonationDto(row);
  }

  async create(
    familyGroupId: string,
    dto: CreateDonationDto,
  ): Promise<DonationResponseDto> {
    const row = await this.prisma.donation.create({
      data: {
        familyGroupId,
        type: dto.type,
        recipient: dto.recipient,
        amount: BigInt(dto.amount),
        currency: dto.currency ?? "IDR",
        donatedAt: new Date(dto.donatedAt),
        isTaxDeductible: dto.isTaxDeductible ?? false,
        receiptUrl: dto.receiptUrl ?? null,
        notes: dto.notes ?? null,
      },
    });
    return toDonationDto(row);
  }

  async update(
    familyGroupId: string,
    id: string,
    dto: UpdateDonationDto,
  ): Promise<DonationResponseDto> {
    const existing = await this.prisma.donation.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) throw new NotFoundException("Donation not found");

    const row = await this.prisma.donation.update({
      where: { id, familyGroupId },
      data: {
        type: dto.type ?? existing.type,
        recipient: dto.recipient ?? existing.recipient,
        amount: dto.amount !== undefined ? BigInt(dto.amount) : existing.amount,
        currency: dto.currency ?? existing.currency,
        donatedAt:
          dto.donatedAt !== undefined
            ? new Date(dto.donatedAt)
            : existing.donatedAt,
        isTaxDeductible:
          dto.isTaxDeductible !== undefined
            ? dto.isTaxDeductible
            : existing.isTaxDeductible,
        receiptUrl:
          dto.receiptUrl !== undefined
            ? (dto.receiptUrl ?? null)
            : existing.receiptUrl,
        notes: dto.notes !== undefined ? (dto.notes ?? null) : existing.notes,
      },
    });
    return toDonationDto(row);
  }

  async remove(familyGroupId: string, id: string): Promise<void> {
    const existing = await this.prisma.donation.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) throw new NotFoundException("Donation not found");
    await this.prisma.donation.delete({ where: { id, familyGroupId } });
  }

  async getTotalDeductibleAmount(
    familyGroupId: string,
    year: number,
  ): Promise<bigint> {
    const start = new Date(`${year}-01-01T00:00:00.000Z`);
    const end = new Date(`${year + 1}-01-01T00:00:00.000Z`);
    const result = await this.prisma.donation.aggregate({
      where: {
        familyGroupId,
        isTaxDeductible: true,
        donatedAt: { gte: start, lt: end },
      },
      _sum: { amount: true },
    });
    return result._sum.amount ?? BigInt(0);
  }
}
