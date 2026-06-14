import { Injectable, NotFoundException } from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

export type ParsedRow = {
  date: Date;
  description: string;
  amount: bigint;
  currency?: string;
};

type BankSyncRow = {
  id: string;
  familyGroupId: string;
  fileName: string;
  uploadedAt: Date;
  rowCount: number;
};

type BankSyncEntryRow = {
  id: string;
  bankSyncId: string;
  date: Date;
  description: string;
  amount: bigint;
  currency: string;
  reconStatus: string;
  matchedTxId: string | null;
  suggestedTxId: string | null;
  createdAt: Date;
};

export type BankSyncDto = {
  id: string;
  familyGroupId: string;
  fileName: string;
  uploadedAt: string;
  rowCount: number;
};

export type BankSyncEntryDto = {
  id: string;
  bankSyncId: string;
  date: string;
  description: string;
  amount: string;
  currency: string;
  reconStatus: string;
  matchedTxId: string | null;
  suggestedTxId: string | null;
  createdAt: string;
};

export type AutoMatchResultDto = {
  totalEntries: number;
  suggested: number;
};

function toBankSyncDto(row: BankSyncRow): BankSyncDto {
  return {
    id: row.id,
    familyGroupId: row.familyGroupId,
    fileName: row.fileName,
    uploadedAt: row.uploadedAt.toISOString(),
    rowCount: row.rowCount,
  };
}

function toBankSyncEntryDto(row: BankSyncEntryRow): BankSyncEntryDto {
  return {
    id: row.id,
    bankSyncId: row.bankSyncId,
    date: row.date.toISOString(),
    description: row.description,
    amount: row.amount.toString(),
    currency: row.currency,
    reconStatus: row.reconStatus,
    matchedTxId: row.matchedTxId,
    suggestedTxId: row.suggestedTxId,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class ReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  async upload(
    familyGroupId: string,
    fileName: string,
    rows: ParsedRow[],
  ): Promise<BankSyncDto> {
    const sync = await this.prisma.$transaction(async (tx) => {
      const created = await tx.bankSync.create({
        data: {
          familyGroupId,
          fileName,
          rowCount: rows.length,
        },
      });

      if (rows.length > 0) {
        await tx.bankSyncEntry.createMany({
          data: rows.map((r) => ({
            bankSyncId: created.id,
            date: r.date,
            description: r.description,
            amount: r.amount,
            currency: r.currency ?? "IDR",
          })),
        });
      }

      return created;
    });

    return toBankSyncDto(sync);
  }

  async findAll(familyGroupId: string): Promise<BankSyncDto[]> {
    const syncs = await this.prisma.bankSync.findMany({
      where: { familyGroupId },
      orderBy: { uploadedAt: "desc" },
    });
    return syncs.map(toBankSyncDto);
  }

  async getEntries(
    familyGroupId: string,
    syncId: string,
  ): Promise<BankSyncEntryDto[]> {
    const sync = await this.prisma.bankSync.findUnique({
      where: { id: syncId, familyGroupId },
    });
    if (!sync) {
      throw new NotFoundException("BankSync not found");
    }

    const entries = await this.prisma.bankSyncEntry.findMany({
      where: { bankSyncId: syncId },
      orderBy: { date: "asc" },
    });
    return entries.map(toBankSyncEntryDto);
  }

  async matchEntry(
    familyGroupId: string,
    syncId: string,
    entryId: string,
    transactionId: string,
  ): Promise<BankSyncEntryDto> {
    const sync = await this.prisma.bankSync.findUnique({
      where: { id: syncId, familyGroupId },
    });
    if (!sync) {
      throw new NotFoundException("BankSync not found");
    }

    const entry = await this.prisma.bankSyncEntry.findUnique({
      where: { id: entryId, bankSyncId: syncId },
    });
    if (!entry) {
      throw new NotFoundException("BankSyncEntry not found");
    }

    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId, familyGroupId },
      select: { id: true },
    });
    if (!tx) throw new NotFoundException("Transaction not found");

    const updated = await this.prisma.bankSyncEntry.update({
      where: { id: entryId },
      data: { reconStatus: "matched", matchedTxId: transactionId },
    });
    return toBankSyncEntryDto(updated);
  }

  async autoMatch(
    familyGroupId: string,
    syncId: string,
  ): Promise<AutoMatchResultDto> {
    const sync = await this.prisma.bankSync.findUnique({
      where: { id: syncId, familyGroupId },
    });
    if (!sync) {
      throw new NotFoundException("BankSync not found");
    }

    const entries = await this.prisma.bankSyncEntry.findMany({
      where: { bankSyncId: syncId, reconStatus: "unmatched" },
    });

    let suggested = 0;

    for (const entry of entries) {
      const dayBefore = new Date(entry.date);
      dayBefore.setDate(dayBefore.getDate() - 1);
      const dayAfter = new Date(entry.date);
      dayAfter.setDate(dayAfter.getDate() + 1);

      const match = await this.prisma.transaction.findFirst({
        where: {
          familyGroupId,
          amount: entry.amount,
          occurredAt: { gte: dayBefore, lte: dayAfter },
        },
      });

      if (match) {
        await this.prisma.bankSyncEntry.update({
          where: { id: entry.id },
          data: { reconStatus: "suggested", suggestedTxId: match.id },
        });
        suggested += 1;
      }
    }

    return { totalEntries: entries.length, suggested };
  }
}
