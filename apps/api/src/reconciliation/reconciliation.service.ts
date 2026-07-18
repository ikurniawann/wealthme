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

      // Nominal tolerance: ±1% of the entry amount, floor ±1.000 IDR — catches
      // bank fees/rounding the old exact-match logic missed.
      const abs = entry.amount < 0n ? -entry.amount : entry.amount;
      const tolerance = abs / 100n > 1000n ? abs / 100n : 1000n;

      const candidates = await this.prisma.transaction.findMany({
        where: {
          familyGroupId,
          amount: {
            gte: entry.amount - tolerance,
            lte: entry.amount + tolerance,
          },
          occurredAt: { gte: dayBefore, lte: dayAfter },
        },
        select: { id: true, amount: true, description: true },
      });

      let best: { id: string; confidence: number } | null = null;
      for (const tx of candidates) {
        const diff =
          tx.amount > entry.amount
            ? tx.amount - entry.amount
            : entry.amount - tx.amount;
        const amountScore = 1 - Number(diff) / Number(tolerance);
        const descScore = tokenSimilarity(
          entry.description,
          tx.description ?? "",
        );
        // Amount dominates; description breaks ties and rescues near-misses.
        const confidence = amountScore * 0.7 + descScore * 0.3;
        if (!best || confidence > best.confidence) {
          best = { id: tx.id, confidence };
        }
      }

      // Suggest only (never auto-confirm); skip weak matches.
      if (best && best.confidence >= 0.5) {
        await this.prisma.bankSyncEntry.update({
          where: { id: entry.id },
          data: { reconStatus: "suggested", suggestedTxId: best.id },
        });
        suggested += 1;
      }
    }

    return { totalEntries: entries.length, suggested };
  }
}

/** Jaccard overlap of lowercased word tokens — cheap description similarity. */
export function tokenSimilarity(a: string, b: string): number {
  const tokens = (s: string): Set<string> =>
    new Set(
      s
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 1),
    );
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  return shared / (ta.size + tb.size - shared);
}
