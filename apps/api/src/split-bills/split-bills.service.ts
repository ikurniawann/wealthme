import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { CreateSplitBillDto } from "./dto/create-split-bill.dto";
import type {
  SplitBillResponseDto,
  SplitParticipantResponseDto,
} from "./dto/split-bill-response.dto";

type ParticipantRow = {
  id: string;
  splitBillId: string;
  name: string;
  amountOwed: bigint;
  status: string;
  paidAt: Date | null;
  createdAt: Date;
};

type SplitBillRow = {
  id: string;
  familyGroupId: string;
  title: string;
  totalAmount: bigint;
  currency: string;
  shareToken: string;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  participants: ParticipantRow[];
};

function toParticipantDto(p: ParticipantRow): SplitParticipantResponseDto {
  return {
    id: p.id,
    splitBillId: p.splitBillId,
    name: p.name,
    amountOwed: p.amountOwed.toString(),
    status: p.status,
    paidAt: p.paidAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

function toSplitBillDto(row: SplitBillRow): SplitBillResponseDto {
  return {
    id: row.id,
    familyGroupId: row.familyGroupId,
    title: row.title,
    totalAmount: row.totalAmount.toString(),
    currency: row.currency,
    shareToken: row.shareToken,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    participants: row.participants.map(toParticipantDto),
  };
}

const PARTICIPANT_INCLUDE = {
  participants: { orderBy: { createdAt: "asc" as const } },
};

@Injectable()
export class SplitBillsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    familyGroupId: string,
    dto: CreateSplitBillDto,
  ): Promise<SplitBillResponseDto> {
    const sumOwed = dto.participants.reduce((s, p) => s + p.amountOwed, 0);
    if (sumOwed !== dto.totalAmount) {
      throw new BadRequestException(
        `Sum of participant amounts (${sumOwed}) must equal totalAmount (${dto.totalAmount})`,
      );
    }

    const splitBill = await this.prisma.$transaction(async (tx) => {
      const bill = await tx.splitBill.create({
        data: {
          familyGroupId,
          title: dto.title,
          totalAmount: BigInt(dto.totalAmount),
          notes: dto.notes ?? null,
          participants: {
            create: dto.participants.map((p) => ({
              name: p.name,
              amountOwed: BigInt(p.amountOwed),
            })),
          },
        },
        include: PARTICIPANT_INCLUDE,
      });
      return bill;
    });

    return toSplitBillDto(splitBill as SplitBillRow);
  }

  async findAll(familyGroupId: string): Promise<SplitBillResponseDto[]> {
    const rows = await this.prisma.splitBill.findMany({
      where: { familyGroupId },
      include: PARTICIPANT_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => toSplitBillDto(r as SplitBillRow));
  }

  async findOne(
    familyGroupId: string,
    id: string,
  ): Promise<SplitBillResponseDto> {
    const row = await this.prisma.splitBill.findUnique({
      where: { id, familyGroupId },
      include: PARTICIPANT_INCLUDE,
    });
    if (!row) throw new NotFoundException("Split bill not found");
    return toSplitBillDto(row as SplitBillRow);
  }

  async getByShareToken(token: string): Promise<SplitBillResponseDto> {
    const row = await this.prisma.splitBill.findUnique({
      where: { shareToken: token },
      include: PARTICIPANT_INCLUDE,
    });
    if (!row) throw new NotFoundException("Split bill not found");
    return toSplitBillDto(row as SplitBillRow);
  }

  async settleParticipant(
    familyGroupId: string,
    splitId: string,
    participantId: string,
  ): Promise<SplitParticipantResponseDto> {
    const split = await this.prisma.splitBill.findUnique({
      where: { id: splitId, familyGroupId },
    });
    if (!split) throw new NotFoundException("Split bill not found");

    const participant = await this.prisma.splitParticipant.findUnique({
      where: { id: participantId, splitBillId: splitId },
    });
    if (!participant) throw new NotFoundException("Participant not found");

    const updated = await this.prisma.splitParticipant.update({
      where: { id: participantId },
      data: { status: "paid", paidAt: new Date() },
    });

    return toParticipantDto(updated as ParticipantRow);
  }

  async remove(familyGroupId: string, id: string): Promise<void> {
    const existing = await this.prisma.splitBill.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) throw new NotFoundException("Split bill not found");
    await this.prisma.splitBill.delete({ where: { id, familyGroupId } });
  }
}
