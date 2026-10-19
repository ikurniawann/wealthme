import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { CoaDirection, Role } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AiKeyService } from "../ai-advisor/ai-key.service";
import {
  CATEGORIZATION_PORT,
  type CategorizationPort,
} from "../categorization/categorization.port";
import { assertBankNotOverdrawn } from "../common/utils/bank-overdraft.util";
import {
  isRowScoped,
  isRowScopedRole,
  restrictedTransactionWhere,
  transactionPrivacyWhere,
  type ScopeSubject,
} from "../common/utils/privacy.util";
import { formatRupiah } from "../common/utils/rupiah.util";
import {
  NOTIFICATION_SENDER_PORT,
  type NotificationSenderPort,
} from "../notifications/notification-sender.port";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import { matchCategoryId } from "./ocr/category-match.util";
import { OcrNotConfiguredError } from "./ocr/ocr-not-configured.error";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { OcrFactory } from "./ocr/ocr.factory";
import {
  checkBudgetAlert,
  checkCashFlowAlert,
  notifyTransaction,
} from "./transaction-alerts.util";
import {
  canModifyTransaction,
  TRANSACTION_EDIT_RIGHTS_DENIED_MESSAGE,
} from "./transaction-edit-rights.util";

import type { CreateTransactionDto } from "./dto/create-transaction.dto";
import type { ListTransactionsQueryDto } from "./dto/list-transactions-query.dto";
import type { ScanReceiptResponseDto } from "./dto/scan-receipt-response.dto";
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
export type ActingMember = {
  id: string;
  userId: string;
  role: Role;
  /** EPIC-030 — effective data scope; absent → the built-in role rule. */
  rowScoped?: boolean;
} | null;

// EPIC-021 Group B #28 — description for the linked admin-fee expense
// auto-created on the destination account of a transfer (e.g. e-wallet
// top-up). Kept in Indonesian to match the rest of user-facing transaction
// copy generated server-side (see WM_CONVENTIONS.md fidelity note).
const ADMIN_FEE_DESCRIPTION = "Biaya admin top-up";

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiKeyService: AiKeyService,
    private readonly ocrFactory: OcrFactory,
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
    viewerRole: ScopeSubject = null,
    viewerUserId?: string,
    // EPIC-036 (edit-rights) — same identity as `ActingMember` elsewhere in
    // this file, needed to compute `canModify` per row on the response DTO.
    actingMember?: ActingMember,
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
          account: { select: { name: true, ownerUserId: true } },
          toAccount: { select: { name: true, ownerUserId: true } },
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
      data: transactions.map((tx) => this.toDto(tx, actingMember)),
      meta: { total, page, limit },
      summary,
    };
  }

  async findOne(
    familyGroupId: string,
    id: string,
    canSeePrivate = true,
    viewerRole: ScopeSubject = null,
    viewerUserId?: string,
    // EPIC-036 (edit-rights) — see findAll's own note.
    actingMember?: ActingMember,
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
        account: { select: { name: true, ownerUserId: true } },
        toAccount: { select: { name: true, ownerUserId: true } },
      },
    });
    if (!tx) throw new NotFoundException("Transaction not found");
    return this.toDto(tx, actingMember);
  }

  async create(
    familyGroupId: string,
    dto: CreateTransactionDto,
    actingMember?: ActingMember,
    // EPIC-023 (rekonsiliasi) — internal-only, never on the DTO: exposing
    // this as a request field would let any client waive the overdraft
    // floor on a live expense. Reconciliation is the one caller allowed to
    // pass `enforceBankFloor: false`, because a bank-line import is not a
    // "fresh, user-initiated debit" in EPIC-021 #22's sense — it is
    // recording money that ALREADY moved, verified against the family's own
    // statement. The account's WealthMe balance lags the real one until
    // enough of the statement has been converted (the opening-balance row
    // is never importable, and a single-row import has no ordering
    // guarantee), so the live-overspend guard produces false positives on
    // real history. See bank-overdraft.util.ts's own doc for the invariant
    // this option is deliberately allowed to skip.
    //
    // Investasi R7 — `idempotencyKey` (internal callers only, e.g. pocket
    // top-up/withdraw) is stored on the main row; a transfer's admin-fee
    // expense gets `<key>:fee` so a replay can find both. A duplicate key
    // raises Prisma P2002 and rolls back the whole write; the caller looks
    // the original up and replays it.
    // `feeDescription` overrides the admin-fee row's description (a pocket
    // withdrawal fee is not a "top-up" fee).
    options?: {
      enforceBankFloor?: boolean;
      idempotencyKey?: string;
      feeDescription?: string;
    },
  ): Promise<TransactionResponseDto | HeldExpenseResponseDto> {
    const enforceBankFloor = options?.enforceBankFloor ?? true;
    const idempotencyKey = options?.idempotencyKey ?? null;
    const account = await this.prisma.account.findUnique({
      where: { id: dto.accountId, familyGroupId },
    });
    if (!account)
      throw new NotFoundException(`Account ${dto.accountId} not found`);
    await this.assertAccountOwnedByActingMember(account, actingMember);
    // Rekening v3 — a closed account keeps its history but takes no new rows.
    if (account.status === "closed") {
      throw new BadRequestException(
        "Rekening ini sudah ditutup. Ubah statusnya dulu untuk mencatat transaksi baru.",
      );
    }

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
      await this.assertAccountOwnedByActingMember(toAccount, actingMember);
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
          idempotencyKey,
        },
        include: {
          category: { select: { name: true } },
          account: { select: { name: true, ownerUserId: true } },
          toAccount: { select: { name: true, ownerUserId: true } },
        },
      });

      if (toAccount) {
        // Real two-sided transfer: debit source, credit destination
        // atomically within this same $transaction. Guards the SOURCE
        // account's debit leg with the caller's `enforceBankFloor` (EPIC-021
        // #22, true by default); the destination's credit leg is never
        // guarded.
        await this.applyTransferBalanceDelta(
          prisma,
          familyGroupId,
          dto.accountId,
          toAccount.id,
          BigInt(dto.amount),
          "add",
          enforceBankFloor,
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
              description: options?.feeDescription ?? ADMIN_FEE_DESCRIPTION,
              occurredAt: new Date(dto.occurredAt),
              createdByUserId: actingMember?.userId ?? null,
              idempotencyKey: idempotencyKey ? `${idempotencyKey}:fee` : null,
            },
          });
          // EPIC-021 #22 — admin fee is itself a debit against the (bank)
          // destination account, guarded the same as the transfer's own
          // source debit above (same `enforceBankFloor`, same caller).
          await this.applyBalanceDelta(
            prisma,
            familyGroupId,
            "expense",
            toAccount.id,
            BigInt(dto.adminFee),
            "add",
            enforceBankFloor,
          );
        }
      } else {
        // EPIC-021 #22 — guarded per the caller's `enforceBankFloor` (income
        // is a no-op for the guard either way; see applyBalanceDelta's early
        // income return).
        await this.applyBalanceDelta(
          prisma,
          familyGroupId,
          dto.type,
          dto.accountId,
          BigInt(dto.amount),
          "add",
          enforceBankFloor,
        );
      }

      return tx;
    });

    if (resolvedCategoryId && dto.type === "expense") {
      void checkBudgetAlert(
        this.prisma,
        this.notificationSender,
        familyGroupId,
        resolvedCategoryId,
      );
    }
    if (dto.type === "expense") {
      void checkCashFlowAlert(this.prisma, familyGroupId);
    }
    void notifyTransaction(
      this.prisma,
      familyGroupId,
      dto.type,
      BigInt(dto.amount),
      created,
      // EPIC-023 Task D (D9) — trusted roles are never held, only notified;
      // an honest per-member "large transaction" cutoff instead of a fixed
      // number nobody set. `?? undefined`: a `null` threshold (the normal
      // case) falls back to notifyTransaction's own default.
      actingMemberThreshold ?? undefined,
      actingMember &&
        (actingMember.rowScoped ??
          (actingMember.role === "dependant" ||
            actingMember.role === "operational"))
        ? actingMember.userId
        : undefined,
    );

    return this.toDto(created, actingMember);
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
          body: `${requesterName} mencoba mencatat pengeluaran ${formatRupiah(amount)} yang melebihi batas dan menunggu persetujuan Anda.`,
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
      include: {
        account: { select: { ownerUserId: true, isPrivate: true } },
        toAccount: { select: { ownerUserId: true } },
      },
    });
    if (!existing) throw new NotFoundException("Transaction not found");
    // EPIC-036 (edit-rights) — additional to every guard below: only the
    // creator or the owner of a leg's private account may mutate an
    // EXISTING row. Checked before assertNotObligationLinked so a locked
    // (obligation-linked) row a caller also lacks edit rights on reports the
    // edit-rights denial, not a confusing obligation message.
    if (!canModifyTransaction(existing, actingMember)) {
      throw new ForbiddenException(TRANSACTION_EDIT_RIGHTS_DENIED_MESSAGE);
    }
    await this.assertNotObligationLinked(existing);
    // Review fix (Rekening v3) — the write rule holds on edits too: a
    // row-scoped member may only touch transactions on an account they own
    // or may post on NOW (a revoked share revokes edits), and may not move a
    // transaction onto someone else's account.
    await this.assertMayWriteExisting(existing, actingMember);

    if (dto.accountId) {
      const acct = await this.prisma.account.findUnique({
        where: { id: dto.accountId, familyGroupId },
      });
      if (!acct)
        throw new NotFoundException(`Account ${dto.accountId} not found`);
      await this.assertAccountOwnedByActingMember(acct, actingMember);
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
          account: { select: { name: true, ownerUserId: true } },
          toAccount: { select: { name: true, ownerUserId: true } },
        },
      });
    });

    return this.toDto(updated, actingMember);
  }

  async remove(
    familyGroupId: string,
    id: string,
    canSeePrivate = true,
    // EPIC-036 (edit-rights) — see findAll's own note.
    actingMember?: ActingMember,
  ): Promise<void> {
    // EPIC-022 A6 follow-up — same 404-not-403, no-existence-leak treatment
    // as `update`/`findOne`.
    const existing = await this.prisma.transaction.findFirst({
      where: { id, familyGroupId, ...transactionPrivacyWhere(canSeePrivate) },
      include: {
        account: { select: { ownerUserId: true, isPrivate: true } },
        toAccount: { select: { ownerUserId: true } },
      },
    });
    if (!existing) throw new NotFoundException("Transaction not found");
    if (!canModifyTransaction(existing, actingMember)) {
      throw new ForbiddenException(TRANSACTION_EDIT_RIGHTS_DENIED_MESSAGE);
    }
    await this.assertNotObligationLinked(existing);
    await this.assertMayWriteExisting(existing, actingMember);

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
    viewerRole: ScopeSubject = null,
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

  /**
   * EPIC-027 B5/B7 (D11/D13) — scanning runs on the family's OWN AI Advisor
   * key, resolved per request and never on a server-wide env key: there is
   * no `ANTHROPIC_API_KEY` fallback and no mock provider, so a family
   * without a key gets an actionable error instead of a fabricated amount.
   * `resolveDecryptedKey` throws `AiKeyCorruptedError` for an unreadable
   * stored key; that propagates untouched (the controller maps it).
   */
  async scanReceipt(
    familyGroupId: string,
    imageBase64: string,
  ): Promise<ScanReceiptResponseDto> {
    const resolvedKey =
      await this.aiKeyService.resolveDecryptedKey(familyGroupId);
    if (!resolvedKey) {
      throw new OcrNotConfiguredError();
    }

    const ocr = this.ocrFactory.create(
      resolvedKey.provider,
      resolvedKey.apiKey,
      // The family's chosen model from Pengaturan; null falls back to the
      // WealthMe default.
      resolvedKey.model,
    );
    const result = await ocr.extractTransaction(imageBase64);

    return {
      ...result,
      categoryId: await this.resolveScannedCategoryId(
        familyGroupId,
        result.categoryHint,
      ),
    };
  }

  /**
   * EPIC-027 D13 — resolves the model's free-text hint against this
   * family's real expense categories. Scoped to `familyGroupId` (the tenant
   * boundary) and read-only: no match means a blank category, never an
   * auto-created one and never a second AI call.
   */
  private async resolveScannedCategoryId(
    familyGroupId: string,
    categoryHint: string,
  ): Promise<string | null> {
    if (!categoryHint.trim()) return null;

    const categories = await this.prisma.category.findMany({
      where: { familyGroupId, kind: "expense" },
      select: { id: true, name: true },
    });
    return matchCategoryId(categoryHint, categories);
  }

  private buildWhere(
    familyGroupId: string,
    query: ListTransactionsQueryDto,
    canSeePrivate = true,
    viewerRole: ScopeSubject = null,
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
    viewerRole: ScopeSubject = null,
    viewerUserId?: string,
  ): Promise<TransactionSummaryDto> {
    const where = this.buildWhere(
      familyGroupId,
      query,
      canSeePrivate,
      viewerRole,
      viewerUserId,
    );

    // EPIC-017 parity: classify by the category's COA direction, exactly like
    // `txCoaDirection` (coa-classify.util.ts) — which /laporan and /beranda
    // both use — and fall back to `type` only for a category-less row. Summing
    // raw `type` here instead counted every wealth-allocation row (an
    // investment purchase, a debt principal payment: `type: "expense"` mapped
    // to a TRANSFER COA account) as spending, so /transaksi's "Pengeluaran"
    // read Rp 64,9 jt against Rp 21,7 jt on the dashboard and every report for
    // the very same six months.
    const directionWhere = (
      direction: CoaDirection,
      fallbackType: Prisma.TransactionWhereInput["type"],
    ): Prisma.TransactionWhereInput => ({
      ...where,
      AND: [
        ...(Array.isArray(where.AND)
          ? where.AND
          : where.AND
            ? [where.AND]
            : []),
        {
          OR: [
            { category: { coaAccount: { direction } } },
            { category: null, type: fallbackType },
          ],
        },
      ],
    });

    const [incomeAgg, expenseAgg] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: directionWhere(CoaDirection.INCOME, "income"),
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: directionWhere(CoaDirection.EXPENSE, {
          notIn: ["income", "transfer"],
        }),
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
   * C4 (group E retry round 4) — `LiabilitiesService.pay()`/`.purchase()`
   * and `InsurancesService.pay()` all mutate `Liability
   * .remainingBalance`/`totalDebt` or `Insurance.renewalDate` in lockstep
   * with creating the linked `Transaction` row (`liabilityId`/
   * `insuranceId` set, E1). `update()`/`remove()` here only ever reversed
   * the ACCOUNT balance delta — never the obligation state — so editing or
   * deleting one of these rows silently desynced the ledger from the debt/
   * coverage it recorded:
   *   - Deleting a mistaken card purchase refunds nothing (it never
   *     touched an account) but leaves the card's `remainingBalance`/
   *     `totalDebt` permanently inflated, with no ledger evidence left to
   *     even notice.
   *   - Deleting a liability payment refunds the cash but leaves
   *     `remainingBalance` reduced — a REAL debt is now understated, and
   *     paying again double-reduces it for the one real outflow.
   *   - Deleting a premium payment refunds the cash AND leaves
   *     `renewalDate` advanced — free coverage.
   *
   * REFUSE, not silently reverse: correctly reversing `pay()`'s principal/
   * interest split, `purchase()`'s balance increment, or an insurance's
   * `renewalDate` advance requires re-deriving exactly what that ONE
   * payment changed — safe only if the obligation has not moved since
   * (another payment, a manual PATCH), which this method cannot verify
   * without re-implementing `pay()`'s entire invariant surface in reverse.
   * The honest correction path that already exists and needs no new
   * mechanism: adjust the Liability's `remainingBalance`/`totalDebt` (or
   * the Insurance's `renewalDate`) directly via its own `PATCH`, THEN
   * edit/delete this ledger row once the obligation is back in sync.
   */
  private async assertNotObligationLinked(tx: {
    id: string;
    liabilityId?: string | null;
    insuranceId?: string | null;
  }): Promise<void> {
    if (tx.liabilityId) {
      throw new ConflictException(
        "Transaksi ini terkait pembayaran/pembelian liabilitas — tidak dapat diedit atau dihapus di sini. Sesuaikan saldo liabilitas terkait terlebih dahulu (PATCH liabilitas), lalu koreksi transaksi ini.",
      );
    }
    if (tx.insuranceId) {
      throw new ConflictException(
        "Transaksi ini terkait pembayaran premi asuransi — tidak dapat diedit atau dihapus di sini. Sesuaikan tanggal jatuh tempo polis terkait terlebih dahulu (PATCH asuransi), lalu koreksi transaksi ini.",
      );
    }
    // Revisi F Finding 2 — a Setor (goal contribution) records its funding
    // via `GoalContribution.transactionId`, a link Transaction itself has no
    // column for, unlike `liabilityId`/`insuranceId` above. Without this
    // check, editing or deleting the ledger row silently desyncs
    // `Goal.currentAmount` from the account balance: the money moves back
    // (or changes amount) but the goal still shows it as contributed.
    const linkedContribution = await this.prisma.goalContribution.findUnique({
      where: { transactionId: tx.id },
      select: { goal: { select: { name: true } } },
    });
    if (linkedContribution) {
      throw new ConflictException(
        `Transaksi ini terkait setoran tujuan "${linkedContribution.goal.name}" — tidak dapat diedit atau dihapus di sini. Sesuaikan tujuan terkait terlebih dahulu, lalu koreksi transaksi ini.`,
      );
    }
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
  /**
   * Review fix (Rekening v3) — the write rule on EXISTING rows: a row-scoped
   * member must still be able to post on one leg of the transaction (owns
   * it, or holds a canPost share on it now). Either leg suffices, matching
   * the EPIC-036 edit-rights decision that a transfer's destination owner
   * may edit it; a revoked share therefore revokes the edit as well.
   */
  private async assertMayWriteExisting(
    existing: {
      accountId: string | null;
      toAccountId: string | null;
      account: { ownerUserId: string | null; isPrivate: boolean } | null;
      toAccount: { ownerUserId: string | null } | null;
    },
    actingMember?: ActingMember,
  ): Promise<void> {
    if (!actingMember || !isRowScoped(actingMember)) return;
    const legs: Array<{
      id: string;
      ownerUserId: string | null;
      isPrivate?: boolean;
    }> = [];
    if (existing.accountId && existing.account)
      legs.push({ id: existing.accountId, ...existing.account });
    if (existing.toAccountId && existing.toAccount)
      legs.push({ id: existing.toAccountId, ...existing.toAccount });
    // A card purchase (no account leg) is governed by edit-rights alone.
    if (legs.length === 0) return;
    let denial: unknown = null;
    for (const leg of legs) {
      try {
        await this.assertAccountOwnedByActingMember(leg, actingMember);
        return;
      } catch (err: unknown) {
        denial = err;
      }
    }
    throw denial;
  }

  private async assertAccountOwnedByActingMember(
    account: { id: string; ownerUserId: string | null; isPrivate?: boolean },
    actingMember?: ActingMember,
  ): Promise<void> {
    // EPIC-030 — effective scope: a Master-customised "own data" role is held
    // to its own accounts on writes too, not only on reads.
    if (!actingMember || !isRowScoped(actingMember)) return;
    if (account.ownerUserId === actingMember.userId) return;
    // Rekening v3 — a Master can share an account with posting rights
    // ("Dibagikan kepada · Bisa catat"); a view-only share is not enough,
    // and a private account (hidden from this member) grants nothing.
    if (account.isPrivate) {
      throw new ForbiddenException(
        "This role may only record transactions on an account they own",
      );
    }
    const share = await this.prisma.accountShare.findUnique({
      where: {
        accountId_userId: {
          accountId: account.id,
          userId: actingMember.userId,
        },
      },
      select: { canPost: true },
    });
    if (share?.canPost) return;
    throw new ForbiddenException(
      "This role may only record transactions on an account they own",
    );
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

  private toDto(
    tx: {
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
      // EPIC-023 E1 / group E retry (MEDIUM 6) — symmetric with liabilityId
      // above; was accepted on create() and persisted, but never surfaced
      // back on the response DTO until now.
      insuranceId?: string | null;
      amount: bigint;
      type: TransactionType;
      description: string | null;
      occurredAt: Date;
      createdAt: Date;
      // EPIC-036 (edit-rights) — needed (with account/toAccount's ownerUserId
      // below) to compute `canModify`. Optional so any caller that genuinely
      // can't supply it (there are none left) still type-checks as "no
      // creator" rather than crashing.
      createdByUserId?: string | null;
      category?: { name: string } | null;
      account?: { name: string; ownerUserId?: string | null } | null;
      toAccount?: { name: string; ownerUserId?: string | null } | null;
    },
    viewerMember?: ActingMember,
  ): TransactionResponseDto {
    return {
      id: tx.id,
      familyGroupId: tx.familyGroupId,
      accountId: tx.accountId,
      toAccountId: tx.toAccountId ?? null,
      categoryId: tx.categoryId,
      liabilityId: tx.liabilityId ?? null,
      insuranceId: tx.insuranceId ?? null,
      amount: tx.amount.toString(),
      type: tx.type,
      description: tx.description,
      categoryName: tx.category?.name ?? null,
      // EPIC-023 Task E retry (MEDIUM 5) — null (not "") for a card
      // purchase: an empty string laundered "no account" into blank data
      // wherever a consumer forgot to guard it (contracts' accountName is
      // now nullable to match).
      accountName: tx.account?.name ?? null,
      toAccountName: tx.toAccount?.name ?? null,
      occurredAt: tx.occurredAt.toISOString(),
      createdAt: tx.createdAt.toISOString(),
      // EPIC-036 (edit-rights) — "Pembuat + pemilik rekening": same rule
      // enforced server-side on update()/remove()/attachments, mirrored here
      // so the web can hide/disable Edit/Hapus instead of round-tripping a
      // 403.
      canModify: canModifyTransaction(
        {
          createdByUserId: tx.createdByUserId ?? null,
          account: tx.account
            ? { ownerUserId: tx.account.ownerUserId ?? null }
            : null,
          toAccount: tx.toAccount
            ? { ownerUserId: tx.toAccount.ownerUserId ?? null }
            : null,
        },
        viewerMember,
      ),
    };
  }
}
