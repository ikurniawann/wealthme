import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Role } from "@prisma/client";

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

// EPIC-019 Task C — the acting member's identity, as read off
// `req.tenantContext.member` by the controller. `undefined`/`null` (the
// default) means an internal/non-member-facing caller — e.g. existing tests,
// or a future service-to-service call — and stays fully unrestricted, exactly
// like the pre-existing `canSeePrivate = true` default elsewhere in this file.
export type ActingMember = { id: string; role: Role } | null;

// EPIC-021 Group B #28 — description for the linked admin-fee expense
// auto-created on the destination account of a transfer (e.g. e-wallet
// top-up). Kept in Indonesian to match the rest of user-facing transaction
// copy generated server-side (see WM_CONVENTIONS.md fidelity note).
const ADMIN_FEE_DESCRIPTION = "Biaya admin top-up";

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
          toAccount: { select: { name: true } },
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
        toAccount: { select: { name: true } },
      },
    });
    if (!tx) throw new NotFoundException("Transaction not found");
    return this.toDto(tx);
  }

  async create(
    familyGroupId: string,
    dto: CreateTransactionDto,
    actingMember?: ActingMember,
  ): Promise<TransactionResponseDto> {
    const account = await this.prisma.account.findUnique({
      where: { id: dto.accountId, familyGroupId },
    });
    if (!account)
      throw new NotFoundException(`Account ${dto.accountId} not found`);

    // EPIC-021 Group B (#23/#27/#28) — real source -> destination transfers.
    // toAccountId/adminFee are only meaningful on a transfer; reject the
    // combination early so a malformed request never reaches the balance
    // transaction below.
    if (dto.toAccountId && dto.type !== "transfer") {
      throw new BadRequestException(
        "toAccountId is only valid for transfer transactions",
      );
    }
    if (dto.adminFee !== undefined && dto.adminFee > 0 && !dto.toAccountId) {
      throw new BadRequestException("adminFee requires a toAccountId");
    }
    // No upper bound on adminFee relative to amount — deliberate. A tiny
    // e-wallet top-up with a flat fee (e.g. Rp 1.000 top-up, Rp 2.500 admin
    // fee) is a real-world case the client described (#28); the fee can
    // legitimately exceed the transfer amount itself. Only `@Min(0)` on the
    // DTO applies.

    let toAccount: { id: string } | null = null;
    if (dto.type === "transfer" && dto.toAccountId) {
      if (dto.toAccountId === dto.accountId) {
        throw new BadRequestException(
          "Source and destination account must differ",
        );
      }
      toAccount = await this.prisma.account.findUnique({
        where: { id: dto.toAccountId, familyGroupId },
      });
      if (!toAccount)
        throw new NotFoundException(`Account ${dto.toAccountId} not found`);
    }

    let resolvedCategoryId = dto.categoryId ?? null;

    // EPIC-019 Task C — a constrained member's allow-list (null = no rows =
    // unrestricted). Resolved once so it can both narrow the auto-category
    // suggestion below to an allowed category AND gate the final check.
    const allowedCategoryIds =
      await this.resolveAllowedCategoryIds(actingMember);

    if (resolvedCategoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: resolvedCategoryId, familyGroupId },
      });
      if (!category)
        throw new NotFoundException(`Category ${resolvedCategoryId} not found`);
    } else if (dto.type === "expense" && dto.description) {
      const candidates = await this.prisma.category.findMany({
        where: {
          familyGroupId,
          kind: "expense",
          ...(allowedCategoryIds && { id: { in: allowedCategoryIds } }),
        },
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

    this.assertCategoryAllowed(
      dto.type,
      resolvedCategoryId,
      allowedCategoryIds,
    );

    const created = await this.prisma.$transaction(async (prisma) => {
      const tx = await prisma.transaction.create({
        data: {
          familyGroupId,
          accountId: dto.accountId,
          toAccountId: toAccount ? dto.toAccountId : null,
          categoryId: resolvedCategoryId,
          amount: BigInt(dto.amount),
          type: dto.type,
          description: dto.description ?? null,
          occurredAt: new Date(dto.occurredAt),
        },
        include: {
          category: { select: { name: true } },
          account: { select: { name: true } },
          toAccount: { select: { name: true } },
        },
      });

      if (toAccount) {
        // Real two-sided transfer: debit source, credit destination
        // atomically within this same $transaction.
        await this.applyTransferBalanceDelta(
          prisma,
          familyGroupId,
          dto.accountId,
          toAccount.id,
          BigInt(dto.amount),
          "add",
        );

        // #28 — e-wallet top-up admin fee: the destination is credited the
        // full transfer amount above, then the fee is charged to the
        // DESTINATION account as its own linked expense Transaction (not a
        // deduction from the transfer amount itself). Simplest honest
        // model: a normal, independently-visible expense row (categoryId
        // null — no fee-specific COA category exists yet), NOT a special
        // field on Transaction. It is not linked back to the parent
        // transfer by FK, so deleting/editing the parent transfer does not
        // cascade to it — the fee already left the destination account and
        // is treated as a real, standalone expense.
        if (dto.adminFee && dto.adminFee > 0) {
          await prisma.transaction.create({
            data: {
              familyGroupId,
              accountId: toAccount.id,
              categoryId: null,
              amount: BigInt(dto.adminFee),
              type: "expense",
              description: ADMIN_FEE_DESCRIPTION,
              occurredAt: new Date(dto.occurredAt),
            },
          });
          await this.applyBalanceDelta(
            prisma,
            familyGroupId,
            "expense",
            toAccount.id,
            BigInt(dto.adminFee),
            "add",
          );
        }
      } else {
        await this.applyBalanceDelta(
          prisma,
          familyGroupId,
          dto.type,
          dto.accountId,
          BigInt(dto.amount),
          "add",
        );
      }

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
    actingMember?: ActingMember,
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

    // EPIC-019 Task C — enforce against the EFFECTIVE (post-patch) type and
    // category, same rationale as the toAccountId invariants below: a PATCH
    // that only changes `type` to "expense" while the category silently
    // stays a disallowed one must be rejected too, not just an explicit
    // `categoryId` in this same payload.
    const effectiveCategoryId =
      dto.categoryId !== undefined ? dto.categoryId : existing.categoryId;
    this.assertCategoryAllowed(
      dto.type ?? existing.type,
      effectiveCategoryId,
      await this.resolveAllowedCategoryIds(actingMember),
    );

    // EPIC-021 Group B — every destination-related invariant below is
    // checked against the EFFECTIVE state (the existing row merged with
    // whatever this patch supplies), never just the fields present in this
    // one PATCH. Two bugs that shape follows from:
    //  1. `PATCH { accountId: <the row's existing toAccountId> }` — with no
    //     toAccountId in the payload — must still be rejected as a
    //     self-referencing transfer; checking only `dto.toAccountId` misses
    //     it because the payload never mentions toAccountId at all.
    //  2. `PATCH { type: "expense", toAccountId: "<id>" }` is a nonsensical
    //     combination and must be rejected (mirrors create()'s check),
    //     rather than silently dropping the caller's toAccountId with a 200.
    const effectiveType = dto.type ?? existing.type;
    const effectiveAccountId = dto.accountId ?? existing.accountId;
    const effectiveToAccountId =
      dto.toAccountId !== undefined ? dto.toAccountId : existing.toAccountId;

    if (dto.toAccountId && effectiveType !== "transfer") {
      throw new BadRequestException(
        "toAccountId is only valid for transfer transactions",
      );
    }
    // Validate a newly-supplied destination belongs to the family group.
    // `dto.toAccountId === null` is an explicit "clear it" request and
    // never needs this lookup.
    if (dto.toAccountId) {
      const toAcct = await this.prisma.account.findUnique({
        where: { id: dto.toAccountId, familyGroupId },
      });
      if (!toAcct)
        throw new NotFoundException(`Account ${dto.toAccountId} not found`);
    }
    if (effectiveToAccountId && effectiveToAccountId === effectiveAccountId) {
      throw new BadRequestException(
        "Source and destination account must differ",
      );
    }

    // toAccountId only makes sense for type = transfer. If the effective
    // type is changing away from "transfer" without an explicit toAccountId
    // in the payload, the destination is auto-cleared here (already proven
    // above this is never a silent drop of an EXPLICITLY-supplied
    // toAccountId — that combination was rejected a few lines up). An
    // explicit `toAccountId: null` also lands here and is honored as-is:
    // the row keeps type = transfer but becomes a legacy one-sided transfer,
    // matching pre-existing rows that never had a destination.
    const newToAccountId =
      effectiveType === "transfer" ? (effectiveToAccountId ?? null) : null;

    const updated = await this.prisma.$transaction(async (prisma) => {
      const amountChanged =
        dto.amount !== undefined && BigInt(dto.amount) !== existing.amount;
      const typeChanged = dto.type !== undefined && dto.type !== existing.type;
      const accountChanged =
        dto.accountId !== undefined && dto.accountId !== existing.accountId;
      const toAccountChanged = newToAccountId !== existing.toAccountId;

      // `undefined` = leave toAccountId untouched below; any other value
      // (including `null`) is written verbatim to the update payload.
      let nextToAccountId: string | null | undefined;

      if (amountChanged || typeChanged || accountChanged || toAccountChanged) {
        // Revert whatever effect the existing row currently has — a real
        // two-sided transfer reverses both legs, everything else reverses
        // its single account delta.
        if (existing.toAccountId) {
          await this.applyTransferBalanceDelta(
            prisma,
            familyGroupId,
            existing.accountId,
            existing.toAccountId,
            existing.amount,
            "revert",
          );
        } else {
          await this.applyBalanceDelta(
            prisma,
            familyGroupId,
            existing.type,
            existing.accountId,
            existing.amount,
            "revert",
          );
        }

        const newAmount =
          dto.amount !== undefined ? BigInt(dto.amount) : existing.amount;

        if (newToAccountId) {
          await this.applyTransferBalanceDelta(
            prisma,
            familyGroupId,
            effectiveAccountId,
            newToAccountId,
            newAmount,
            "add",
          );
        } else {
          await this.applyBalanceDelta(
            prisma,
            familyGroupId,
            effectiveType,
            effectiveAccountId,
            newAmount,
            "add",
          );
        }

        nextToAccountId = newToAccountId;
      }

      return prisma.transaction.update({
        where: { id },
        data: {
          ...(dto.accountId !== undefined && { accountId: dto.accountId }),
          ...(nextToAccountId !== undefined && {
            toAccountId: nextToAccountId,
          }),
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
          toAccount: { select: { name: true } },
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
      // Mirrors create()/update() — a real two-sided transfer must reverse
      // BOTH the source debit and the destination credit; anything else
      // (income/expense/legacy one-sided transfer) reverses its single
      // account delta. The admin-fee expense (if any) is NOT cascaded here —
      // see the create() comment: it is a standalone Transaction.
      if (existing.toAccountId) {
        await this.applyTransferBalanceDelta(
          prisma,
          familyGroupId,
          existing.accountId,
          existing.toAccountId,
          existing.amount,
          "revert",
        );
      } else {
        await this.applyBalanceDelta(
          prisma,
          familyGroupId,
          existing.type,
          existing.accountId,
          existing.amount,
          "revert",
        );
      }
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
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...((query.from ?? query.to) && {
        occurredAt: {
          ...(query.from && { gte: new Date(query.from) }),
          ...(query.to && { lte: new Date(query.to) }),
        },
      }),
      // `transactionPrivacyWhere` may itself contribute a top-level `account`
      // and/or `OR` key — spread it BEFORE the account-transfer filter below
      // so its shape is untouched, then fold the account match into its own
      // `AND` branch (a distinct key) instead of a second top-level `OR`,
      // which would silently clobber the privacy filter's `OR`.
      ...transactionPrivacyWhere(canSeePrivate),
      // EPIC-021 Group B (#24 completeness) — a per-account "Mutasi" filter
      // must include transactions where this account is either the SOURCE
      // or the DESTINATION of a real two-sided transfer; matching only
      // `accountId` silently hides every incoming transfer from that
      // account's own statement view.
      ...(query.accountId && {
        AND: [
          {
            OR: [
              { accountId: query.accountId },
              { toAccountId: query.accountId },
            ],
          },
        ],
      }),
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

  /**
   * EPIC-019 Task C — resolves a constrained member's allow-listed category
   * ids. `null` means unrestricted: no acting member context (internal
   * caller), an owner/admin_staff (always exempt per the epic decision), or
   * a `member` with zero MemberCategoryAllowance rows (backward compatible
   * with every pre-existing member).
   */
  private async resolveAllowedCategoryIds(
    actingMember?: ActingMember,
  ): Promise<string[] | null> {
    if (!actingMember || actingMember.role !== Role.member) return null;
    const rows = await this.prisma.memberCategoryAllowance.findMany({
      where: { memberId: actingMember.id },
      select: { categoryId: true },
    });
    if (rows.length === 0) return null;
    return rows.map((r) => r.categoryId);
  }

  /**
   * EPIC-019 Task C — only expense transactions are constrained; income and
   * transfer are unaffected. `allowedCategoryIds === null` means unrestricted
   * (see `resolveAllowedCategoryIds`). A restricted member must pick one of
   * their allowed categories — an uncategorized expense is also rejected,
   * since "must use an allowed category" implies a positive selection.
   */
  private assertCategoryAllowed(
    type: TransactionType,
    categoryId: string | null,
    allowedCategoryIds: string[] | null,
  ): void {
    if (type !== "expense" || allowedCategoryIds === null) return;
    if (categoryId && allowedCategoryIds.includes(categoryId)) return;
    throw new ForbiddenException(
      `Kategori ${categoryId ?? "(tidak dipilih)"} tidak diizinkan untuk akun ini. Kategori yang diizinkan: ${allowedCategoryIds.join(", ")}`,
    );
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
      // "expense" and legacy one-sided "transfer" (no toAccountId) both
      // debit the single tracked account — unchanged, pre-existing behavior.
      await prisma.account.update({
        where: { id: accountId, familyGroupId },
        data: { balance: { increment: -amount * sign } },
      });
    }
  }

  /**
   * Real two-sided transfer (EPIC-021 Group B #23/#27/#28): debits the
   * source account and credits the destination account atomically, within
   * the caller's existing `$transaction`. `direction: "revert"` flips both
   * legs back — used by update() and remove().
   */
  private async applyTransferBalanceDelta(
    prisma: Parameters<Parameters<PrismaService["$transaction"]>[0]>[0],
    familyGroupId: string,
    accountId: string,
    toAccountId: string,
    amount: bigint,
    direction: "add" | "revert",
  ): Promise<void> {
    const sign = direction === "add" ? BigInt(1) : BigInt(-1);
    await prisma.account.update({
      where: { id: accountId, familyGroupId },
      data: { balance: { increment: -amount * sign } },
    });
    await prisma.account.update({
      where: { id: toAccountId, familyGroupId },
      data: { balance: { increment: amount * sign } },
    });
  }

  private toDto(tx: {
    id: string;
    familyGroupId: string;
    accountId: string;
    toAccountId?: string | null;
    categoryId: string | null;
    amount: bigint;
    type: TransactionType;
    description: string | null;
    occurredAt: Date;
    createdAt: Date;
    category?: { name: string } | null;
    account?: { name: string };
    toAccount?: { name: string } | null;
  }): TransactionResponseDto {
    return {
      id: tx.id,
      familyGroupId: tx.familyGroupId,
      accountId: tx.accountId,
      toAccountId: tx.toAccountId ?? null,
      categoryId: tx.categoryId,
      amount: tx.amount.toString(),
      type: tx.type,
      description: tx.description,
      categoryName: tx.category?.name ?? null,
      accountName: tx.account?.name ?? "",
      toAccountName: tx.toAccount?.name ?? null,
      occurredAt: tx.occurredAt.toISOString(),
      createdAt: tx.createdAt.toISOString(),
    };
  }
}
