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
import { assertBankNotOverdrawn } from "../common/utils/bank-overdraft.util";
import {
  isRowScopedRole,
  restrictedTransactionWhere,
  transactionPrivacyWhere,
} from "../common/utils/privacy.util";
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
  HeldExpenseResponseDto,
  TransactionListResponseDto,
  TransactionResponseDto,
  TransactionSummaryDto,
} from "./dto/transaction-response.dto";
import type { UpdateTransactionDto } from "./dto/update-transaction.dto";
import type { Prisma, TransactionType } from "@prisma/client";

// EPIC-019 Task C — the acting member's identity, as read off
// `req.tenantContext.member` by the controller. `undefined`/`null` (the
// default) means an internal/non-member-facing caller — e.g. existing tests,
// or a future service-to-service call — and stays fully unrestricted, exactly
// like the pre-existing `canSeePrivate = true` default elsewhere in this file.
// `userId` (EPIC-023 Task C) is needed to stamp `createdByUserId` and to
// enforce the row-scoped roles' "own account only" invariant in `create()`.
export type ActingMember = { id: string; userId: string; role: Role } | null;

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
   * `viewerRole`/`viewerUserId` (EPIC-023 Task C) narrow a `dependant`/
   * `operational` viewer to transactions on an account they own or that
   * they personally recorded — see `restrictedTransactionWhere`.
   */
  async findAll(
    familyGroupId: string,
    query: ListTransactionsQueryDto,
    canSeePrivate = true,
    viewerRole: Role | null = null,
    viewerUserId?: string,
  ): Promise<TransactionListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = this.buildWhere(
      familyGroupId,
      query,
      canSeePrivate,
      viewerRole,
      viewerUserId,
    );

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
      viewerRole,
      viewerUserId,
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
    viewerRole: Role | null = null,
    viewerUserId?: string,
  ): Promise<TransactionResponseDto> {
    // findFirst (not findUnique) so the relation-based privacy filter can apply:
    // a `member` requesting a transaction tied to a private account/category
    // gets the not-found path — its existence must not leak. Same treatment
    // (EPIC-023 Task C) for a `dependant`/`operational` viewer and a
    // transaction outside `restrictedTransactionWhere` — its existence must
    // not leak either.
    const tx = await this.prisma.transaction.findFirst({
      where: {
        id,
        familyGroupId,
        AND: [
          transactionPrivacyWhere(canSeePrivate),
          restrictedTransactionWhere(viewerRole, viewerUserId),
        ],
      },
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
  ): Promise<TransactionResponseDto | HeldExpenseResponseDto> {
    const account = await this.prisma.account.findUnique({
      where: { id: dto.accountId, familyGroupId },
    });
    if (!account)
      throw new NotFoundException(`Account ${dto.accountId} not found`);
    this.assertAccountOwnedByActingMember(account, actingMember);

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

    let toAccount: { id: string; ownerUserId: string | null } | null = null;
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
      this.assertAccountOwnedByActingMember(toAccount, actingMember);
    }

    // EPIC-023 E1 — tenant-scoped lookups: an unscoped FK write would let a
    // caller link a transaction to another family's Liability/Insurance row
    // just by guessing its id. Composite `{ id, familyGroupId }` where,
    // mirrors every other cross-family FK check in this file.
    if (dto.liabilityId) {
      const liability = await this.prisma.liability.findUnique({
        where: { id: dto.liabilityId, familyGroupId },
      });
      if (!liability) {
        throw new NotFoundException(`Liability ${dto.liabilityId} not found`);
      }
    }
    if (dto.insuranceId) {
      const insurance = await this.prisma.insurance.findUnique({
        where: { id: dto.insuranceId, familyGroupId },
      });
      if (!insurance) {
        throw new NotFoundException(`Insurance ${dto.insuranceId} not found`);
      }
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

    // EPIC-023 Task D (D3/D9, US-FAM-14) — every other validation above has
    // already passed (account/category/allow-list), so a held expense is
    // never blocked on something unrelated to the threshold itself. Read
    // once, reused below both for the hold decision (row-scoped roles) and
    // to make the trusted-role "large transaction" notification honestly
    // per-member (see notifyTransaction) instead of a fixed number nobody
    // set.
    const actingMemberThreshold = actingMember
      ? await this.getMemberThreshold(actingMember.id)
      : null;

    // STRICTLY BEFORE the balance-mutating $transaction below — a held
    // expense must NEVER touch a balance. `>` not `>=`: the acceptance
    // criterion says "above" the limit, so an expense AT the threshold
    // posts normally.
    if (
      actingMember &&
      isRowScopedRole(actingMember.role) &&
      dto.type === "expense" &&
      actingMemberThreshold !== null &&
      BigInt(dto.amount) > actingMemberThreshold
    ) {
      return this.holdExpenseForApproval(
        familyGroupId,
        actingMember,
        dto,
        resolvedCategoryId,
      );
    }

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
          // EPIC-023 Task C — who recorded this row (null for an internal/
          // non-member-facing caller, exactly like every other actingMember
          // default in this file).
          createdByUserId: actingMember?.userId ?? null,
          // EPIC-023 E1 — already tenant-scope-verified above.
          liabilityId: dto.liabilityId ?? null,
          insuranceId: dto.insuranceId ?? null,
        },
        include: {
          category: { select: { name: true } },
          account: { select: { name: true } },
          toAccount: { select: { name: true } },
        },
      });

      if (toAccount) {
        // Real two-sided transfer: debit source, credit destination
        // atomically within this same $transaction. `enforceBankFloor: true`
        // — this is a fresh, user-initiated debit of the SOURCE account
        // (EPIC-021 #22); the destination's credit leg is never guarded.
        await this.applyTransferBalanceDelta(
          prisma,
          familyGroupId,
          dto.accountId,
          toAccount.id,
          BigInt(dto.amount),
          "add",
          true,
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
              createdByUserId: actingMember?.userId ?? null,
            },
          });
          // EPIC-021 #22 — admin fee is itself a fresh debit against the
          // (bank) destination account, guarded the same as any other
          // user-initiated expense.
          await this.applyBalanceDelta(
            prisma,
            familyGroupId,
            "expense",
            toAccount.id,
            BigInt(dto.adminFee),
            "add",
            true,
          );
        }
      } else {
        // EPIC-021 #22 — fresh, user-initiated debit (income is a no-op for
        // the guard; see applyBalanceDelta's early income return).
        await this.applyBalanceDelta(
          prisma,
          familyGroupId,
          dto.type,
          dto.accountId,
          BigInt(dto.amount),
          "add",
          true,
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
      // EPIC-023 Task D (D9) — trusted roles are never held, only notified;
      // an honest per-member "large transaction" cutoff instead of a fixed
      // number nobody set. `?? undefined`: a `null` threshold (the normal
      // case) falls back to notifyTransaction's own default.
      actingMemberThreshold ?? undefined,
    );

    return this.toDto(created);
  }

  /**
   * EPIC-023 Task D (D3/D9, US-FAM-14) — the member already tried to spend;
   * this NEVER creates a Transaction row and NEVER touches a balance (the
   * acceptance criterion, verbatim: "no account balance changes until the
   * head approves"). It records the attempt as an AllowanceRequest
   * (kind = held_expense) so the head can replay it later via
   * AllowanceRequestsService.approve, and notifies the trusted roles that
   * something is waiting — D9's "merely notify trusted roles" half.
   */
  private async holdExpenseForApproval(
    familyGroupId: string,
    actingMember: NonNullable<ActingMember>,
    dto: CreateTransactionDto,
    categoryId: string | null,
  ): Promise<HeldExpenseResponseDto> {
    const request = await this.prisma.allowanceRequest.create({
      data: {
        familyGroupId,
        requesterUserId: actingMember.userId,
        // See the schema comment on AllowanceRequest — for `held_expense`
        // this is the account the deferred expense would DEBIT, not an
        // account being funded.
        targetAccountId: dto.accountId,
        kind: "held_expense",
        amount: BigInt(dto.amount),
        categoryId,
        description: dto.description ?? null,
      },
    });

    void this.notifyOwnersOfHeldExpense(
      familyGroupId,
      actingMember.userId,
      BigInt(dto.amount),
    );

    return {
      held: true,
      allowanceRequestId: request.id,
      amount: request.amount.toString(),
    };
  }

  private async notifyOwnersOfHeldExpense(
    familyGroupId: string,
    requesterUserId: string,
    amount: bigint,
  ): Promise<void> {
    try {
      const requester = await this.prisma.user.findUnique({
        where: { id: requesterUserId },
        select: { name: true },
      });
      const requesterName = requester?.name ?? "Anggota keluarga";
      await this.prisma.notification.create({
        data: {
          familyGroupId,
          title: "Transaksi besar menunggu persetujuan",
          body: `${requesterName} mencoba mencatat pengeluaran Rp ${amount.toString()} yang melebihi batas dan menunggu persetujuan Anda.`,
          icon: "⏳",
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Held expense notification skipped: ${msg}`);
    }
  }

  /**
   * EPIC-023 Task D (D3) — a row-scoped member's own per-member threshold
   * (null = unset, the normal case). No acting member context (internal
   * caller) is always unrestricted, matching every other `actingMember`
   * default in this file.
   */
  private async getMemberThreshold(memberId: string): Promise<bigint | null> {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: { largeTxnThreshold: true },
    });
    return member?.largeTxnThreshold ?? null;
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
    // EPIC-023 Task D (D3/D9) — the acting member's own largeTxnThreshold,
    // when set. Trusted roles are never held (only row-scoped roles are —
    // see create()'s gate above), so a threshold here only ever narrows
    // WHEN this member's "large transaction" notification fires; it never
    // blocks anything. Defaults to the pre-existing fixed cutoff when the
    // member has no threshold set (the normal case for every pre-existing
    // member).
    bigThreshold: bigint = BigInt(5_000_000),
  ): Promise<void> {
    try {
      // Only income/expense produce a feed notification; transfers stay silent.
      const isIncome = type === "income";
      const isExpense = type === "expense";
      if (!isIncome && !isExpense) return;

      const prefs = await ownerNotifPrefs(this.prisma, familyGroupId);
      const isBig = amount >= bigThreshold;
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
    canSeePrivate = true,
  ): Promise<TransactionResponseDto> {
    // EPIC-022 A6 follow-up — `findFirst` (not `findUnique`) so the same
    // relation-based privacy filter `findOne` already applies also gates a
    // PATCH: a `member` must not be able to edit (or read back via the
    // response) a transaction tied to a private account/category. Its
    // existence must not leak, so this 404s exactly like "doesn't exist".
    const existing = await this.prisma.transaction.findFirst({
      where: { id, familyGroupId, ...transactionPrivacyWhere(canSeePrivate) },
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
        // its single account delta. EPIC-023 E3 (D12) — a credit-card
        // purchase (`existing.accountId === null`) never touched an account
        // in the first place, so there is nothing to revert; skip both the
        // transfer and single-account branches for it.
        //
        // EPIC-021 #22 — neither the revert call below nor the reapply call
        // further down passes `enforceBankFloor`, so both stay unguarded by
        // the bank-overdraft check (default `false`). This is deliberate:
        // an already-persisted transaction must always remain editable, even
        // on a bank account that has since been spent down below the
        // original credit — reversal integrity beats the overdraft
        // invariant here. Only create()'s fresh debits are guarded.
        if (existing.toAccountId && existing.accountId) {
          await this.applyTransferBalanceDelta(
            prisma,
            familyGroupId,
            existing.accountId,
            existing.toAccountId,
            existing.amount,
            "revert",
          );
        } else if (existing.accountId) {
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

        // EPIC-023 E3 (D12) — a null `effectiveAccountId` only happens for a
        // liability-linked, accountless row whose PATCH also leaves
        // accountId unset; there is nothing to (re)apply a balance delta
        // against, so both branches below are skipped for it too.
        if (newToAccountId && effectiveAccountId) {
          await this.applyTransferBalanceDelta(
            prisma,
            familyGroupId,
            effectiveAccountId,
            newToAccountId,
            newAmount,
            "add",
          );
        } else if (effectiveAccountId) {
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

  async remove(
    familyGroupId: string,
    id: string,
    canSeePrivate = true,
  ): Promise<void> {
    // EPIC-022 A6 follow-up — same 404-not-403, no-existence-leak treatment
    // as `update`/`findOne`.
    const existing = await this.prisma.transaction.findFirst({
      where: { id, familyGroupId, ...transactionPrivacyWhere(canSeePrivate) },
    });
    if (!existing) throw new NotFoundException("Transaction not found");

    await this.prisma.$transaction(async (prisma) => {
      // Mirrors create()/update() — a real two-sided transfer must reverse
      // BOTH the source debit and the destination credit; anything else
      // (income/expense/legacy one-sided transfer) reverses its single
      // account delta. The admin-fee expense (if any) is NOT cascaded here —
      // see the create() comment: it is a standalone Transaction.
      // EPIC-021 #22 — `enforceBankFloor` is deliberately omitted (defaults
      // false): deleting a transaction must always be possible, even if the
      // bank account it touches has since been spent below the original
      // credit. See applyBalanceDelta's doc for the full rationale.
      // EPIC-023 E3 (D12) — a credit-card purchase (`accountId === null`)
      // never touched an account; nothing to revert for it.
      if (existing.toAccountId && existing.accountId) {
        await this.applyTransferBalanceDelta(
          prisma,
          familyGroupId,
          existing.accountId,
          existing.toAccountId,
          existing.amount,
          "revert",
        );
      } else if (existing.accountId) {
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
    viewerRole: Role | null = null,
    viewerUserId?: string,
  ): Promise<TransactionSummaryDto> {
    return this.computeSummary(
      familyGroupId,
      query,
      canSeePrivate,
      viewerRole,
      viewerUserId,
    );
  }

  async scanReceipt(imageBase64: string): Promise<OcrResult> {
    return this.ocrPort.extractTransaction(imageBase64);
  }

  private buildWhere(
    familyGroupId: string,
    query: ListTransactionsQueryDto,
    canSeePrivate = true,
    viewerRole: Role | null = null,
    viewerUserId?: string,
  ) {
    // `transactionPrivacyWhere`, `restrictedTransactionWhere` (EPIC-023 Task
    // C), and the per-account "Mutasi" match below may EACH contribute a
    // top-level `OR` key — collected into one `AND` array instead of
    // object-spreading them together, so none can silently clobber another's
    // `OR`. An empty `{}` fragment (the common case: an unrestricted role,
    // or no accountId filter) is a no-op inside `AND`.
    const andClauses: Prisma.TransactionWhereInput[] = [
      transactionPrivacyWhere(canSeePrivate),
      restrictedTransactionWhere(viewerRole, viewerUserId),
    ];
    if (query.accountId) {
      // EPIC-021 Group B (#24 completeness) — a per-account "Mutasi" filter
      // must include transactions where this account is either the SOURCE
      // or the DESTINATION of a real two-sided transfer; matching only
      // `accountId` silently hides every incoming transfer from that
      // account's own statement view.
      andClauses.push({
        OR: [{ accountId: query.accountId }, { toAccountId: query.accountId }],
      });
    }

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
      AND: andClauses,
    };
  }

  private async computeSummary(
    familyGroupId: string,
    query: ListTransactionsQueryDto,
    canSeePrivate = true,
    viewerRole: Role | null = null,
    viewerUserId?: string,
  ): Promise<TransactionSummaryDto> {
    const where = this.buildWhere(
      familyGroupId,
      query,
      canSeePrivate,
      viewerRole,
      viewerUserId,
    );

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
   * EPIC-023 Task C (D3/D5) — a `dependant`/`operational` acting member may
   * only post a transaction against an account they own; every other role
   * is unrestricted (the CASL "create Transaction" grant those two roles
   * hold would otherwise let them move money on the shared family account,
   * which the row-scoping decision explicitly forbids). No acting member
   * context (internal caller) is also unrestricted, matching every other
   * `actingMember` default in this file.
   */
  private assertAccountOwnedByActingMember(
    account: { ownerUserId: string | null },
    actingMember?: ActingMember,
  ): void {
    if (!actingMember || !isRowScopedRole(actingMember.role)) return;
    if (account.ownerUserId !== actingMember.userId) {
      throw new ForbiddenException(
        "This role may only record transactions on an account they own",
      );
    }
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
    // EPIC-021 #22 — true ONLY for a fresh, user-initiated debit (create()'s
    // expense/legacy-one-sided-transfer and admin-fee call sites). MUST stay
    // false (the default) for every call inside update()/remove()'s
    // revert-then-reapply cycle: those re-derive the account's state from a
    // previously-persisted, already-accepted transaction, and reversal
    // integrity (a transaction must always be editable/deletable, even on an
    // account that has since been spent down below the original credit)
    // beats the overdraft invariant on those paths. Guarding the revert step
    // would also produce false positives from the two-phase revert-then-
    // reapply mechanic itself, not the user's actual net edit.
    enforceBankFloor = false,
  ): Promise<void> {
    const sign = direction === "add" ? BigInt(1) : BigInt(-1);

    if (type === "income") {
      await prisma.account.update({
        where: { id: accountId, familyGroupId },
        data: { balance: { increment: amount * sign } },
      });
      return;
    }

    // "expense" and legacy one-sided "transfer" (no toAccountId) both debit
    // the single tracked account — unchanged, pre-existing behavior.
    const debitAmount = amount * sign;
    if (enforceBankFloor && debitAmount > BigInt(0)) {
      await assertBankNotOverdrawn(
        prisma,
        familyGroupId,
        accountId,
        debitAmount,
      );
    }
    await prisma.account.update({
      where: { id: accountId, familyGroupId },
      data: { balance: { increment: -debitAmount } },
    });
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
    // EPIC-021 #22 — see applyBalanceDelta's doc above; true ONLY for
    // create()'s fresh transfer-FROM-bank source debit, never for
    // update()/remove()'s revert-then-reapply cycle. Only the SOURCE leg is
    // ever guarded — the destination's credit leg is never blocked.
    enforceBankFloor = false,
  ): Promise<void> {
    const sign = direction === "add" ? BigInt(1) : BigInt(-1);
    const sourceDebit = amount * sign;
    if (enforceBankFloor && sourceDebit > BigInt(0)) {
      await assertBankNotOverdrawn(
        prisma,
        familyGroupId,
        accountId,
        sourceDebit,
      );
    }
    await prisma.account.update({
      where: { id: accountId, familyGroupId },
      data: { balance: { increment: -sourceDebit } },
    });
    await prisma.account.update({
      where: { id: toAccountId, familyGroupId },
      data: { balance: { increment: amount * sign } },
    });
  }

  private toDto(tx: {
    id: string;
    familyGroupId: string;
    // EPIC-023 E3 (D12) — null for a credit-card purchase (LiabilitiesService
    // .purchase()), which touches no account. Every transaction created
    // through THIS service's own create() still requires a non-null
    // accountId (CreateTransactionDto), unchanged.
    accountId: string | null;
    toAccountId?: string | null;
    categoryId: string | null;
    // EPIC-023 E1/E3 — surfaced on the response DTO so the web transaction
    // list can identify a card purchase (liabilityId set, accountId null)
    // instead of relying on an accountName text heuristic.
    liabilityId?: string | null;
    amount: bigint;
    type: TransactionType;
    description: string | null;
    occurredAt: Date;
    createdAt: Date;
    category?: { name: string } | null;
    account?: { name: string } | null;
    toAccount?: { name: string } | null;
  }): TransactionResponseDto {
    return {
      id: tx.id,
      familyGroupId: tx.familyGroupId,
      accountId: tx.accountId,
      toAccountId: tx.toAccountId ?? null,
      categoryId: tx.categoryId,
      liabilityId: tx.liabilityId ?? null,
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
