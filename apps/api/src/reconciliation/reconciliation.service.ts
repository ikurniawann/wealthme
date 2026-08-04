import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TransactionsService } from "../transactions/transactions.service";

import type { SplitEntryDto } from "./dto/split-entry.dto";
import type { TransactionResponseDto } from "../transactions/dto/transaction-response.dto";

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

/**
 * EPIC-021 Group C (#9) — read-only summary of the matched Transaction shown
 * inline on a reconciliation entry. `matchedTxId`/`suggestedTxId` on
 * `BankSyncEntry` are plain string columns (no Prisma relation — same
 * loose-FK convention as `Donation.transactionId`), so this is always
 * assembled via a manual second query, never a Prisma `include`.
 */
export type MatchedTransactionSummaryDto = {
  id: string;
  accountId: string;
  accountName: string;
  toAccountId: string | null;
  toAccountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  amount: string;
  type: string;
  description: string | null;
  occurredAt: string;
  createdAt: string;
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
  // EPIC-021 Group C (#9) — null when unmatched/suggested-only, or when the
  // matched transaction id no longer resolves to a row in this tenant.
  matchedTransaction: MatchedTransactionSummaryDto | null;
};

export type AutoMatchResultDto = {
  totalEntries: number;
  suggested: number;
};

/** Raw shape of a batch-fetched matched Transaction row (see getEntries). */
type RawMatchedTxRow = {
  id: string;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  amount: bigint;
  type: string;
  description: string | null;
  occurredAt: Date;
  createdAt: Date;
  account: { name: string } | null;
  toAccount: { name: string } | null;
  category: { name: string } | null;
};

function toMatchedTransactionDto(
  tx: RawMatchedTxRow,
): MatchedTransactionSummaryDto {
  return {
    id: tx.id,
    accountId: tx.accountId,
    accountName: tx.account?.name ?? "",
    toAccountId: tx.toAccountId,
    toAccountName: tx.toAccount?.name ?? null,
    categoryId: tx.categoryId,
    categoryName: tx.category?.name ?? null,
    amount: tx.amount.toString(),
    type: tx.type,
    description: tx.description,
    occurredAt: tx.occurredAt.toISOString(),
    createdAt: tx.createdAt.toISOString(),
  };
}

/** Maps the already-stringified TransactionsService response (used right
 * after `splitEntry` creates the transfer) into the same summary shape. */
function transactionResponseToMatchedSummary(
  tx: TransactionResponseDto,
): MatchedTransactionSummaryDto {
  return {
    id: tx.id,
    accountId: tx.accountId,
    accountName: tx.accountName,
    toAccountId: tx.toAccountId,
    toAccountName: tx.toAccountName,
    categoryId: tx.categoryId,
    categoryName: tx.categoryName,
    amount: tx.amount,
    type: tx.type,
    description: tx.description,
    occurredAt: tx.occurredAt,
    createdAt: tx.createdAt,
  };
}

function toBankSyncDto(row: BankSyncRow): BankSyncDto {
  return {
    id: row.id,
    familyGroupId: row.familyGroupId,
    fileName: row.fileName,
    uploadedAt: row.uploadedAt.toISOString(),
    rowCount: row.rowCount,
  };
}

function toBankSyncEntryDto(
  row: BankSyncEntryRow,
  matchedTransaction: MatchedTransactionSummaryDto | null = null,
): BankSyncEntryDto {
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
    matchedTransaction,
  };
}

@Injectable()
export class ReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionsService: TransactionsService,
  ) {}

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

    const txById = await this.fetchMatchedTxMap(familyGroupId, entries);
    return entries.map((e) =>
      toBankSyncEntryDto(
        e,
        e.matchedTxId ? (txById.get(e.matchedTxId) ?? null) : null,
      ),
    );
  }

  /**
   * EPIC-021 Group C (#9) — batch-fetches the matched Transaction (+ account/
   * category names) for every entry that has a `matchedTxId`, in a single
   * query, instead of N+1 lookups per row. `matchedTxId` is a plain string
   * column with no Prisma relation (see `MatchedTransactionSummaryDto`
   * comment), so this manual join is the only option.
   */
  private async fetchMatchedTxMap(
    familyGroupId: string,
    entries: { matchedTxId: string | null }[],
  ): Promise<Map<string, MatchedTransactionSummaryDto>> {
    const ids = [
      ...new Set(
        entries
          .map((e) => e.matchedTxId)
          .filter((id): id is string => id !== null),
      ),
    ];
    if (ids.length === 0) return new Map();

    const txs = await this.prisma.transaction.findMany({
      where: { id: { in: ids }, familyGroupId },
      include: {
        account: { select: { name: true } },
        toAccount: { select: { name: true } },
        category: { select: { name: true } },
      },
    });

    return new Map(txs.map((t) => [t.id, toMatchedTransactionDto(t)]));
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
      include: {
        account: { select: { name: true } },
        toAccount: { select: { name: true } },
        category: { select: { name: true } },
      },
    });
    if (!tx) throw new NotFoundException("Transaction not found");

    const updated = await this.prisma.bankSyncEntry.update({
      where: { id: entryId },
      data: { reconStatus: "matched", matchedTxId: transactionId },
    });
    return toBankSyncEntryDto(updated, toMatchedTransactionDto(tx));
  }

  /**
   * EPIC-021 Group C (#29) — split a reconciliation line (bank shows one
   * combined amount, e.g. an e-wallet top-up + admin fee) into a real
   * principal transfer + linked fee expense, then mark the entry matched
   * against the transfer. Delegates the actual Transaction creation to
   * `TransactionsService.create`, which already tenant-validates both
   * accounts, rejects same-account transfers, and — per EPIC-021 Decision
   * #10/#28 — creates the admin-fee expense on the DESTINATION account
   * atomically with the transfer inside its own `$transaction`.
   *
   * NOT fully atomic end-to-end: `transactionsService.create` commits its
   * own `$transaction` first, then this method issues a SEPARATE
   * `bankSyncEntry.update` to record the match. If that second write fails,
   * the transfer/fee Transactions already exist but the entry stays
   * unmatched — a retry would then create a duplicate transfer. Accepted for
   * this iteration (matches the task's own "atomically-enough" framing); a
   * future hardening pass could expose a transaction-scoped create on
   * TransactionsService so both writes share one Prisma `$transaction`.
   */
  async splitEntry(
    familyGroupId: string,
    syncId: string,
    entryId: string,
    dto: SplitEntryDto,
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

    if (entry.reconStatus === "matched") {
      throw new BadRequestException(
        "Entry is already matched — unmatch it first before splitting",
      );
    }

    // Bank-statement amount follows signed convention (negative = money
    // leaving the account, the normal case for an e-wallet top-up debit);
    // principal/adminFee are always entered as positive magnitudes by the
    // user, so the sum is compared against the entry's absolute value.
    const entryMagnitude = entry.amount < 0n ? -entry.amount : entry.amount;
    const splitTotal = BigInt(dto.principalAmount) + BigInt(dto.adminFee);
    if (splitTotal !== entryMagnitude) {
      throw new BadRequestException(
        `Principal + admin fee (${splitTotal.toString()}) must equal the entry amount (${entryMagnitude.toString()})`,
      );
    }

    const transfer: TransactionResponseDto =
      await this.transactionsService.create(familyGroupId, {
        accountId: dto.accountId,
        toAccountId: dto.toAccountId,
        amount: dto.principalAmount,
        adminFee: dto.adminFee,
        type: "transfer",
        description: dto.description,
        occurredAt: entry.date.toISOString(),
      });

    const updated = await this.prisma.bankSyncEntry.update({
      where: { id: entryId },
      data: { reconStatus: "matched", matchedTxId: transfer.id },
    });

    return toBankSyncEntryDto(
      updated,
      transactionResponseToMatchedSummary(transfer),
    );
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
