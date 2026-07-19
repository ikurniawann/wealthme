import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";

import {
  CATEGORIZATION_PORT,
  type CategorizationPort,
} from "../categorization/categorization.port";
import { transactionPrivacyWhere } from "../common/utils/privacy.util";
import {
  ownerNotifPrefs,
  resolveNotifPrefs,
} from "../notifications/notification-prefs";
import {
  NOTIFICATION_SENDER_PORT,
  type NotificationSenderPort,
} from "../notifications/notification-sender.port";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import { OCR_PORT, type OcrPort, type OcrResult } from "./ocr/ocr.port";

import type { CreateTransactionDto } from "./dto/create-transaction.dto";
import type { ListTransactionsQueryDto } from "./dto/list-transactions-query.dto";
import type {
  TransactionListResponseDto,
  TransactionResponseDto,
  TransactionSummaryDto,
} from "./dto/transaction-response.dto";
import type { UpdateTransactionDto } from "./dto/update-transaction.dto";
import type { TransactionType } from "@prisma/client";

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(OCR_PORT) private readonly ocrPort: OcrPort,
    @Inject(CATEGORIZATION_PORT)
    private readonly categorizationPort: CategorizationPort,
    @Inject(NOTIFICATION_SENDER_PORT)
    private readonly notificationSender: NotificationSenderPort,
  ) {}

  /**
   * `canSeePrivate` defaults to `true` so internal/non-member-facing callers
   * stay unfiltered — only member-facing controller calls pass `false`.
   */
  async findAll(
    familyGroupId: string,
    query: ListTransactionsQueryDto,
    canSeePrivate = true,
  ): Promise<TransactionListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = this.buildWhere(familyGroupId, query, canSeePrivate);

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        // occurredAt is date-only from the add-transaction form, so same-day
        // entries tie — createdAt breaks the tie so the most recently added
        // transaction is always first.
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
        include: {
          category: { select: { name: true } },
          account: { select: { name: true } },
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    const summary = await this.computeSummary(
      familyGroupId,
      query,
      canSeePrivate,
    );

    return {
      data: transactions.map(this.toDto),
      meta: { total, page, limit },
      summary,
    };
  }

  async findOne(
    familyGroupId: string,
    id: string,
    canSeePrivate = true,
  ): Promise<TransactionResponseDto> {
    // findFirst (not findUnique) so the relation-based privacy filter can apply:
    // a `member` requesting a transaction tied to a private account/category
    // gets the not-found path — its existence must not leak.
    const tx = await this.prisma.transaction.findFirst({
      where: { id, familyGroupId, ...transactionPrivacyWhere(canSeePrivate) },
      include: {
        category: { select: { name: true } },
        account: { select: { name: true } },
      },
    });
    if (!tx) throw new NotFoundException("Transaction not found");
    return this.toDto(tx);
  }

  async create(
    familyGroupId: string,
    dto: CreateTransactionDto,
  ): Promise<TransactionResponseDto> {
    const account = await this.prisma.account.findUnique({
      where: { id: dto.accountId, familyGroupId },
    });
    if (!account)
      throw new NotFoundException(`Account ${dto.accountId} not found`);

    let resolvedCategoryId = dto.categoryId ?? null;

    if (resolvedCategoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: resolvedCategoryId, familyGroupId },
      });
      if (!category)
        throw new NotFoundException(`Category ${resolvedCategoryId} not found`);
    } else if (dto.type === "expense" && dto.description) {
      const candidates = await this.prisma.category.findMany({
        where: { familyGroupId, kind: "expense" },
        select: { id: true, name: true, kind: true },
      });
      try {
        resolvedCategoryId = await this.categorizationPort.suggest(
          dto.description,
          Number(dto.amount),
          dto.type,
          candidates,
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Auto-categorization skipped: ${msg}`);
      }
    }

    const created = await this.prisma.$transaction(async (prisma) => {
      const tx = await prisma.transaction.create({
        data: {
          familyGroupId,
          accountId: dto.accountId,
          categoryId: resolvedCategoryId,
          amount: BigInt(dto.amount),
          type: dto.type,
          description: dto.description ?? null,
          occurredAt: new Date(dto.occurredAt),
        },
        include: {
          category: { select: { name: true } },
          account: { select: { name: true } },
        },
      });

      await this.applyBalanceDelta(
        prisma,
        familyGroupId,
        dto.type,
        dto.accountId,
        BigInt(dto.amount),
        "add",
      );

      return tx;
    });

    if (resolvedCategoryId && dto.type === "expense") {
      void this.checkBudgetAlert(familyGroupId, resolvedCategoryId);
    }
    if (dto.type === "expense") {
      void this.checkCashFlowAlert(familyGroupId);
    }
    void this.notifyTransaction(
      familyGroupId,
      dto.type,
      BigInt(dto.amount),
      created,
    );

    return this.toDto(created);
  }

  private async checkBudgetAlert(
    familyGroupId: string,
    categoryId: string,
  ): Promise<void> {
    try {
      const budget = await this.prisma.budget.findFirst({
        where: { familyGroupId, categoryId },
        select: { id: true, limitAmount: true },
      });
      if (!budget || budget.limitAmount <= BigInt(0)) return;

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const agg = await this.prisma.transaction.aggregate({
        where: {
          familyGroupId,
          categoryId,
          type: "expense",
          occurredAt: { gte: monthStart, lt: nextMonthStart },
        },
        _sum: { amount: true },
      });

      // The new transaction is already committed when this runs, so the
      // aggregate includes it — no manual addition needed.
      const spent = agg._sum.amount ?? BigInt(0);
      const usagePct = Number((spent * BigInt(100)) / budget.limitAmount);
      if (usagePct < 80) return;

      const [owner, category] = await Promise.all([
        this.prisma.member.findFirst({
          where: { familyGroupId, role: "owner" },
          include: {
            user: {
              select: { email: true, name: true, notificationPrefs: true },
            },
          },
        }),
        this.prisma.category.findUnique({
          where: { id: categoryId, familyGroupId },
          select: { name: true },
        }),
      ]);
      if (!owner) return;
      if (!resolveNotifPrefs(owner.user.notificationPrefs).budget80) return;

      const safeName = escapeHtml(category?.name ?? "kategori ini");
      const subject =
        usagePct >= 100
          ? `Anggaran ${safeName} terlampaui!`
          : `Anggaran ${safeName} sudah ${usagePct}%`;
      const htmlBody = `<p>Halo ${escapeHtml(owner.user.name)},</p>
<p>Pengeluaran untuk <strong>${safeName}</strong> bulan ini telah mencapai <strong>${usagePct}%</strong> dari anggaran.</p>
<p>Segera tinjau anggaran Anda di WealthMe.</p>`;

      await Promise.all([
        this.notificationSender.sendEmail(
          owner.user.email,
          owner.user.name,
          subject,
          htmlBody,
        ),
        this.prisma.notification.create({
          data: {
            familyGroupId,
            title: subject,
            body: `Pengeluaran ${safeName} sudah ${usagePct}% dari anggaran bulan ini.`,
            icon: "💸",
          },
        }),
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Budget alert skipped: ${msg}`);
    }
  }

  private async checkCashFlowAlert(familyGroupId: string): Promise<void> {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const [incomeAgg, expenseAgg] = await Promise.all([
        this.prisma.transaction.aggregate({
          where: {
            familyGroupId,
            type: "income",
            occurredAt: { gte: monthStart, lt: nextMonthStart },
          },
          _sum: { amount: true },
        }),
        this.prisma.transaction.aggregate({
          where: {
            familyGroupId,
            type: "expense",
            occurredAt: { gte: monthStart, lt: nextMonthStart },
          },
          _sum: { amount: true },
        }),
      ]);

      const income = incomeAgg._sum.amount ?? BigInt(0);
      const expense = expenseAgg._sum.amount ?? BigInt(0);

      if (income <= BigInt(0)) return;

      const usagePct = Number((expense * BigInt(100)) / income);
      if (usagePct < 80) return;

      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const existing = await this.prisma.notification.findFirst({
        where: { familyGroupId, icon: "⚠️", createdAt: { gte: today } },
      });
      if (existing) return;

      const title =
        usagePct >= 100
          ? "Pengeluaran Melebihi Pemasukan!"
          : `Pengeluaran Bulan Ini Sudah ${usagePct}%`;
      const body =
        usagePct >= 100
          ? `Pengeluaran bulan ini sudah ${usagePct}% dari total pemasukan. Kurangi pengeluaran segera.`
          : `Pengeluaran bulan ini sudah ${usagePct}% dari total pemasukan. Pantau pengeluaranmu.`;

      await this.prisma.notification.create({
        data: { familyGroupId, title, body, icon: "⚠️" },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Cash flow alert skipped: ${msg}`);
    }
  }

  private async notifyTransaction(
    familyGroupId: string,
    type: string,
    amount: bigint,
    tx: { category: { name: string } | null; account: { name: string } | null },
  ): Promise<void> {
    try {
      // Only income/expense produce a feed notification; transfers stay silent.
      const isIncome = type === "income";
      const isExpense = type === "expense";
      if (!isIncome && !isExpense) return;

      const prefs = await ownerNotifPrefs(this.prisma, familyGroupId);
      const isBig = amount >= BigInt(5_000_000);
      const wantByType = isIncome ? prefs.txnIn : prefs.txnOut;
      // txnBig is an additive alert for large amounts of either direction.
      if (!wantByType && !(isBig && prefs.txnBig)) return;

      const label = isIncome ? "Transaksi masuk" : "Transaksi keluar";
      const catName = tx.category?.name ?? "Tanpa kategori";
      await this.prisma.notification.create({
        data: {
          familyGroupId,
          title: isBig ? `${label} besar` : label,
          body: `${label} Rp ${amount.toString()} — ${catName}`,
          icon: isIncome ? "📥" : "📤",
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Transaction notification skipped: ${msg}`);
    }
  }

  async update(
    familyGroupId: string,
    id: string,
    dto: UpdateTransactionDto,
  ): Promise<TransactionResponseDto> {
    const existing = await this.prisma.transaction.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) throw new NotFoundException("Transaction not found");

    if (dto.accountId) {
      const acct = await this.prisma.account.findUnique({
        where: { id: dto.accountId, familyGroupId },
      });
      if (!acct)
        throw new NotFoundException(`Account ${dto.accountId} not found`);
    }
    if (dto.categoryId) {
      const cat = await this.prisma.category.findUnique({
        where: { id: dto.categoryId, familyGroupId },
      });
      if (!cat)
        throw new NotFoundException(`Category ${dto.categoryId} not found`);
    }

    const updated = await this.prisma.$transaction(async (prisma) => {
      const amountChanged =
        dto.amount !== undefined && BigInt(dto.amount) !== existing.amount;
      const typeChanged = dto.type !== undefined && dto.type !== existing.type;
      const accountChanged =
        dto.accountId !== undefined && dto.accountId !== existing.accountId;

      if (amountChanged || typeChanged || accountChanged) {
        await this.applyBalanceDelta(
          prisma,
          familyGroupId,
          existing.type,
          existing.accountId,
          existing.amount,
          "revert",
        );

        const newType = dto.type ?? existing.type;
        const newAccountId = dto.accountId ?? existing.accountId;
        const newAmount =
          dto.amount !== undefined ? BigInt(dto.amount) : existing.amount;
        await this.applyBalanceDelta(
          prisma,
          familyGroupId,
          newType,
          newAccountId,
          newAmount,
          "add",
        );
      }

      return prisma.transaction.update({
        where: { id },
        data: {
          ...(dto.accountId !== undefined && { accountId: dto.accountId }),
          ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
          ...(dto.amount !== undefined && { amount: BigInt(dto.amount) }),
          ...(dto.type !== undefined && { type: dto.type }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
          ...(dto.occurredAt !== undefined && {
            occurredAt: new Date(dto.occurredAt),
          }),
        },
        include: {
          category: { select: { name: true } },
          account: { select: { name: true } },
        },
      });
    });

    return this.toDto(updated);
  }

  async remove(familyGroupId: string, id: string): Promise<void> {
    const existing = await this.prisma.transaction.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) throw new NotFoundException("Transaction not found");

    await this.prisma.$transaction(async (prisma) => {
      await this.applyBalanceDelta(
        prisma,
        familyGroupId,
        existing.type,
        existing.accountId,
        existing.amount,
        "revert",
      );
      await prisma.transaction.delete({ where: { id } });
    });
  }

  async getSummary(
    familyGroupId: string,
    query: ListTransactionsQueryDto,
    canSeePrivate = true,
  ): Promise<TransactionSummaryDto> {
    return this.computeSummary(familyGroupId, query, canSeePrivate);
  }

  async scanReceipt(imageBase64: string): Promise<OcrResult> {
    return this.ocrPort.extractTransaction(imageBase64);
  }

  private buildWhere(
    familyGroupId: string,
    query: ListTransactionsQueryDto,
    canSeePrivate = true,
  ) {
    return {
      familyGroupId,
      ...(query.type && { type: query.type }),
      ...(query.accountId && { accountId: query.accountId }),
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...((query.from ?? query.to) && {
        occurredAt: {
          ...(query.from && { gte: new Date(query.from) }),
          ...(query.to && { lte: new Date(query.to) }),
        },
      }),
      ...transactionPrivacyWhere(canSeePrivate),
    };
  }

  private async computeSummary(
    familyGroupId: string,
    query: ListTransactionsQueryDto,
    canSeePrivate = true,
  ): Promise<TransactionSummaryDto> {
    const where = this.buildWhere(familyGroupId, query, canSeePrivate);

    const [incomeAgg, expenseAgg] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { ...where, type: "income" },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { ...where, type: "expense" },
        _sum: { amount: true },
      }),
    ]);

    const totalIncome = incomeAgg._sum.amount ?? BigInt(0);
    const totalExpense = expenseAgg._sum.amount ?? BigInt(0);
    const netBalance = totalIncome - totalExpense;

    return {
      totalIncome: totalIncome.toString(),
      totalExpense: totalExpense.toString(),
      netBalance: netBalance.toString(),
      period: {
        from: query.from ?? null,
        to: query.to ?? null,
      },
    };
  }

  private async applyBalanceDelta(
    prisma: Parameters<Parameters<PrismaService["$transaction"]>[0]>[0],
    familyGroupId: string,
    type: TransactionType,
    accountId: string,
    amount: bigint,
    direction: "add" | "revert",
  ): Promise<void> {
    const sign = direction === "add" ? BigInt(1) : BigInt(-1);

    if (type === "income") {
      await prisma.account.update({
        where: { id: accountId, familyGroupId },
        data: { balance: { increment: amount * sign } },
      });
    } else {
      await prisma.account.update({
        where: { id: accountId, familyGroupId },
        data: { balance: { increment: -amount * sign } },
      });
    }
  }

  private toDto(tx: {
    id: string;
    familyGroupId: string;
    accountId: string;
    categoryId: string | null;
    amount: bigint;
    type: TransactionType;
    description: string | null;
    occurredAt: Date;
    createdAt: Date;
    category?: { name: string } | null;
    account?: { name: string };
  }): TransactionResponseDto {
    return {
      id: tx.id,
      familyGroupId: tx.familyGroupId,
      accountId: tx.accountId,
      categoryId: tx.categoryId,
      amount: tx.amount.toString(),
      type: tx.type,
      description: tx.description,
      categoryName: tx.category?.name ?? null,
      accountName: tx.account?.name ?? "",
      occurredAt: tx.occurredAt.toISOString(),
      createdAt: tx.createdAt.toISOString(),
    };
  }
}
