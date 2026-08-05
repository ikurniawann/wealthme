import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { assertBankNotOverdrawn } from "../common/utils/bank-overdraft.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import { splitPayment } from "./amortisation.util";

import type { CreateLiabilityDto } from "./dto/create-liability.dto";
import type {
  LiabilityResponseDto,
  LiabilitySummaryResponseDto,
} from "./dto/liability-response.dto";
import type { PayLiabilityDto } from "./dto/pay-liability.dto";
import type { PurchaseLiabilityDto } from "./dto/purchase-liability.dto";
import type { UpdateLiabilityDto } from "./dto/update-liability.dto";

// EPIC-023 A1/A2 — the loan-interest EXPENSE account each chart provisions:
// GENERIC_COA_CHART (every real family, via registration + the A1 backfill
// migration) uses 20009 "Bunga Pinjaman"; the demo seed's richer chart uses
// 21304 "Loan Interest". Matching on either code keeps `pay()` correct for
// both charts without hardcoding one over the other.
const LOAN_INTEREST_COA_CODES = ["20009", "21304"];

type TxClient = Parameters<Parameters<PrismaService["$transaction"]>[0]>[0];

function toLiabilityDto(
  liability: {
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
  },
  paidThisPeriod = false,
): LiabilityResponseDto {
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
    // EPIC-023 E2 — whether a payment linked to THIS liability (`liabilityId`
    // on Transaction, E1) landed within the current calendar-month period.
    // Drives the budget page's obligations Pay list (D11, US-LIAB-3) without
    // requiring the frontend to separately query transactions.
    paidThisPeriod,
    notes: liability.notes,
    currency: liability.currency,
    createdAt: liability.createdAt.toISOString(),
    updatedAt: liability.updatedAt.toISOString(),
  };
}

/** Mirrors `BudgetsService.findAll`'s "this calendar month" window. */
function currentMonthBounds(): { monthStart: Date; monthEnd: Date } {
  const now = new Date();
  return {
    monthStart: new Date(now.getFullYear(), now.getMonth(), 1),
    monthEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
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

    const paidSet = await this.paidThisPeriodIds(
      familyGroupId,
      liabilities.map((l) => l.id),
    );

    return liabilities.map((l) => toLiabilityDto(l, paidSet.has(l.id)));
  }

  /**
   * EPIC-023 E2 — set of liability ids with at least one payment
   * (`Transaction.liabilityId`, E1) `occurredAt` in the current calendar
   * month. One extra query, same "current month" window
   * `BudgetsService.findAll` already uses.
   */
  private async paidThisPeriodIds(
    familyGroupId: string,
    liabilityIds: string[],
  ): Promise<Set<string>> {
    if (liabilityIds.length === 0) return new Set();
    const { monthStart, monthEnd } = currentMonthBounds();
    const rows = await this.prisma.transaction.findMany({
      where: {
        familyGroupId,
        liabilityId: { in: liabilityIds },
        occurredAt: { gte: monthStart, lte: monthEnd },
      },
      select: { liabilityId: true },
      distinct: ["liabilityId"],
    });
    return new Set(rows.map((r) => r.liabilityId!));
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

  /**
   * EPIC-023 E2 (D11, US-LIAB-3) — creating a liability with a non-zero
   * `minimumPayment` auto-creates (or tops up) a FIXED budget line for it,
   * so the obligation shows up on the budget page without a manual step.
   * `minimumPayment === 0` liabilities (e.g. 0% family loans with no
   * scheduled payment) intentionally get NO budget line — there is nothing
   * due to budget for yet; adding a minimum payment later via `update()` is
   * out of this task's scope (deferred, see this task's Automation Log).
   *
   * Category derivation: reuses `resolvePrincipalCategoryId` UNCHANGED —
   * the SAME group-5 (Account Payable) TRANSFER category `pay()` already
   * posts the principal leg against (see that method's doc comment). This
   * is deliberate, not incidental: the budget's `spentAmount` is computed
   * by `BudgetsService` from `Transaction` rows sharing the budget's
   * `categoryId` (EPIC-022 A6). Giving the budget a DIFFERENT, liability-
   * specific category would look plausible but would silently break
   * budget-vs-actual tracking — payments would never register as spend
   * against it. Every liability in a family group therefore shares ONE
   * FIXED "cicilan pokok" budget line (monthly period), whose limit is the
   * SUM of every liability's `minimumPayment` — see `upsertFixedBudgetLine`
   * for how the `@@unique([familyGroupId, categoryId, period])` collision
   * this implies is handled (via `upsert`, not a caught P2002).
   */
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

    const liability = await this.prisma.$transaction(async (tx) => {
      const created = await tx.liability.create({
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

      if (minimumPayment > BigInt(0)) {
        const categoryId = await this.resolvePrincipalCategoryId(
          tx,
          familyGroupId,
        );
        await this.markCategoryFixed(tx, categoryId);
        await this.upsertFixedBudgetLine(tx, {
          familyGroupId,
          categoryId,
          contribution: minimumPayment,
          liabilityId: created.id,
        });
      }

      return created;
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

  /**
   * EPIC-023 E2 (D11) — refuses (409, never a silent cascade) while a FIXED
   * budget line derived from this liability's category still exists. This
   * is a READ-ONLY category lookup (no self-heal `create`): if the shared
   * principal category was never provisioned, there is nothing to check
   * and deletion proceeds.
   */
  async remove(familyGroupId: string, id: string): Promise<void> {
    const existing = await this.prisma.liability.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) {
      throw new NotFoundException("Liability not found");
    }

    const category = await this.prisma.category.findFirst({
      where: {
        familyGroupId,
        coaAccount: { groupNum: 5, direction: "TRANSFER" },
      },
      select: { id: true, name: true },
    });
    if (category) {
      const budget = await this.prisma.budget.findUnique({
        where: {
          familyGroupId_categoryId_period: {
            familyGroupId,
            categoryId: category.id,
            period: "monthly",
          },
        },
      });
      if (budget) {
        throw new ConflictException(
          `Tidak dapat menghapus liabilitas ini karena masih memiliki anggaran tetap "${category.name}". Hapus atau sesuaikan anggaran tersebut terlebih dahulu.`,
        );
      }
    }

    await this.prisma.liability.delete({ where: { id, familyGroupId } });
  }

  /**
   * Idempotently sets `budgetType: FIXED` on the category's linked
   * CoaAccount so the auto-created budget line reads as FIXED (D11) via
   * the existing transitive `Category.coaAccount.budgetType` field
   * (`BudgetsService.toDto`) — no new column on `Budget` needed for this.
   */
  private async markCategoryFixed(
    tx: TxClient,
    categoryId: string,
  ): Promise<void> {
    const category = await tx.category.findUniqueOrThrow({
      where: { id: categoryId },
      select: { coaAccountId: true },
    });
    await tx.coaAccount.update({
      where: { id: category.coaAccountId },
      data: { budgetType: "FIXED" },
    });
  }

  /**
   * `Budget` has `@@unique([familyGroupId, categoryId, period])`; since
   * every liability in a family group shares ONE principal category (see
   * `create()`'s doc comment), a second liability's auto-budget WILL
   * collide with the first's row. `upsert` (a single atomic
   * `INSERT ... ON CONFLICT DO UPDATE`) handles that collision without a
   * caught P2002 or a retry loop: the first liability creates the line,
   * every subsequent one tops up `limitAmount` by its own contribution.
   * `liabilityId` is only set on the `create` branch — see the `Budget`
   * model's doc comment for what that FK means once shared.
   */
  private async upsertFixedBudgetLine(
    tx: TxClient,
    params: {
      familyGroupId: string;
      categoryId: string;
      contribution: bigint;
      liabilityId: string;
    },
  ): Promise<void> {
    const { familyGroupId, categoryId, contribution, liabilityId } = params;
    await tx.budget.upsert({
      where: {
        familyGroupId_categoryId_period: {
          familyGroupId,
          categoryId,
          period: "monthly",
        },
      },
      create: {
        familyGroupId,
        categoryId,
        period: "monthly",
        limitAmount: contribution,
        liabilityId,
      },
      update: {
        limitAmount: { increment: contribution },
      },
    });
  }

  /**
   * Records a payment against a liability: splits it into principal and
   * interest (EPIC-023 A2 — `splitPayment`), debits the source account by
   * the full payment, reduces `remainingBalance` by the principal only, and
   * posts the principal against a group-5 TRANSFER category and the
   * interest (when non-zero) against the loan-interest EXPENSE category.
   * Everything happens inside one `$transaction` so a failure never leaves
   * the account debited without the liability/ledger updated, or vice versa.
   *
   * EPIC-023 review follow-up — a plain (default READ COMMITTED)
   * `$transaction` is NOT enough here: `liability.remainingBalance` and the
   * `maxPayable` guard were both derived from a read taken at the top of the
   * transaction, so two concurrent `pay()` calls could each read the same
   * balance, each compute a valid-looking principal/maxPayable, and both
   * commit — under-reducing the balance while jointly overpaying past what
   * either payment alone would have allowed. Mirrors the count-then-act race
   * `CategoriesService.remove()` closes the same way (see its comment for
   * the full Postgres rationale): run the transaction at Serializable
   * isolation so Postgres detects the conflicting concurrent write and
   * aborts the loser with a serialization failure (Prisma P2034), then
   * retry a bounded number of times so the loser re-reads the now-current
   * balance and recomputes correctly instead of surfacing a raw 500 to the
   * user for what is, from their point of view, a transient conflict.
   *
   * The same retry also covers P2002 from `createCategoryOrUseRaceWinner()`:
   * two concurrent first-ever `pay()` calls for a family group can race to
   * create the same self-heal Category. That P2002 aborts the whole
   * transaction (see that method's comment for why it cannot be recovered
   * in-transaction), so the fix is the same shape as P2034 — roll back and
   * retry in a fresh transaction, where the self-heal `findFirst` now finds
   * the winner's already-committed row.
   */
  async pay(
    familyGroupId: string,
    id: string,
    dto: PayLiabilityDto,
  ): Promise<LiabilityResponseDto> {
    const paymentAmount = guardBigInt("amount", dto.amount);
    if (paymentAmount <= BigInt(0)) {
      throw new BadRequestException("amount must be greater than zero");
    }

    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await this.prisma.$transaction(
          (tx) => this.runPayment(tx, familyGroupId, id, dto, paymentAmount),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (err) {
        // Retryable: P2034 (serialization failure on the balance/overdraft
        // read-then-write) and P2002 (concurrent category self-heal race —
        // see createCategoryOrUseRaceWinner()'s comment for why it cannot be
        // recovered inside the same aborted transaction). Anything else is
        // rethrown immediately; both known codes are rethrown once
        // MAX_ATTEMPTS is exhausted.
        const isRetryable =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          (err.code === "P2034" || err.code === "P2002");
        if (!isRetryable || attempt === MAX_ATTEMPTS) {
          throw err;
        }
        // Retry: another concurrent pay() committed first. Looping re-enters
        // $transaction, which re-reads the liability/account/category state
        // inside runPayment against the now-current, post-conflict state.
      }
    }
    // Unreachable — the loop above always either returns or throws.
    throw new Error("pay() retry loop exited unexpectedly");
  }

  private async runPayment(
    tx: TxClient,
    familyGroupId: string,
    id: string,
    dto: PayLiabilityDto,
    paymentAmount: bigint,
  ): Promise<LiabilityResponseDto> {
    const liability = await tx.liability.findUnique({
      where: { id, familyGroupId },
    });
    if (!liability) {
      throw new NotFoundException("Liability not found");
    }

    // Tenant scoping: the source account must belong to the SAME family
    // group as the liability being paid.
    const sourceAccount = await tx.account.findUnique({
      where: { id: dto.sourceAccountId, familyGroupId },
    });
    if (!sourceAccount) {
      throw new NotFoundException(`Account ${dto.sourceAccountId} not found`);
    }

    const { interest, principal } = splitPayment({
      paymentAmount,
      remainingBalance: liability.remainingBalance,
      annualInterestRatePercent: liability.interestRate.toString(),
    });

    const maxPayable = liability.remainingBalance + interest;
    if (paymentAmount > maxPayable) {
      throw new BadRequestException(
        `Payment amount exceeds the remaining balance plus interest due (max ${maxPayable.toString()})`,
      );
    }

    // EPIC-021 #22 — this is a fresh, user-initiated debit of the SOURCE
    // account, exactly the class of debit the bank-overdraft floor guards
    // against elsewhere (TransactionsService.create()). Shared helper so
    // both services enforce the same invariant from one definition.
    await assertBankNotOverdrawn(
      tx,
      familyGroupId,
      sourceAccount.id,
      paymentAmount,
    );

    await tx.account.update({
      where: { id: sourceAccount.id, familyGroupId },
      data: { balance: { decrement: paymentAmount } },
    });

    // Atomic decrement (defence in depth alongside Serializable isolation
    // above) — never re-derives the new balance from the stale `liability`
    // read, so even if isolation were ever loosened this can't silently
    // regress to the read-then-write race this fix closes.
    const updated = await tx.liability.update({
      where: { id, familyGroupId },
      data: { remainingBalance: { decrement: principal } },
    });

    const occurredAt = new Date();

    if (principal > BigInt(0)) {
      const principalCategoryId = await this.resolvePrincipalCategoryId(
        tx,
        familyGroupId,
      );
      // EPIC-023 E1 — the principal leg is money moving from cash into
      // paying down debt, not a real expense (the group-5 TRANSFER category
      // above already excludes it from P&L via txCoaDirection's
      // category-first rule — see reports.service.spec.ts's A3 tests). This
      // finishes that fix: `type` now matches the category's own direction
      // instead of lying "expense", so the transaction list badge is honest
      // too (deferred from Task A's Automation Log). `liabilityId` links
      // this row back to the obligation it settles (D10, US-LIAB-4).
      await tx.transaction.create({
        data: {
          familyGroupId,
          accountId: sourceAccount.id,
          categoryId: principalCategoryId,
          amount: principal,
          type: "transfer",
          liabilityId: id,
          description: `Pembayaran pokok ${liability.name}`,
          occurredAt,
        },
      });
    }

    // Skip the interest transaction entirely when interest is 0 (e.g. a
    // 0% liability) — there is nothing real to post.
    if (interest > BigInt(0)) {
      const interestCategoryId = await this.resolveInterestCategoryId(
        tx,
        familyGroupId,
      );
      await tx.transaction.create({
        data: {
          familyGroupId,
          accountId: sourceAccount.id,
          categoryId: interestCategoryId,
          amount: interest,
          type: "expense",
          description: `Bunga ${liability.name}`,
          occurredAt,
        },
      });
    }

    return toLiabilityDto(updated);
  }

  /**
   * EPIC-023 Task E3 (D12, US-LIAB-5) — records a credit-card purchase.
   * Unlike `pay()`, this NEVER debits an Account: "a credit card stays a
   * liability; spending raises the card's debt and leaves the bank
   * untouched" (D12). Both `remainingBalance` (what is currently owed) and
   * `totalDebt` (the lifetime figure `paymentRatio` is derived from) are
   * raised by the SAME atomic `{ increment }` — a plain single-statement
   * UPDATE, which Postgres always applies against the row's CURRENT value
   * regardless of isolation level, so no read-then-write race is possible
   * here (unlike `pay()`'s principal/interest split, which reads
   * `remainingBalance` to COMPUTE a value before writing it back and
   * therefore needs the Serializable-plus-retry treatment — see `pay()`'s
   * doc comment). One linked Transaction is created with `accountId: null`
   * (E3's schema change) and `liabilityId` set (E1), so the purchase shows
   * up in the ledger without ever implying a bank/cash account paid for it.
   *
   * Access is gated `@CheckAbility("manage", "Liability")` at the
   * controller — the SAME grant `pay()`/`create()`/`update()` already
   * require. Per `CaslAbilityFactory`, the two ROW-SCOPED roles
   * (`dependant`/`operational`, D3/D9's threshold-gated roles) hold NO
   * grant at all on the `Liability` subject — not even `read` — so a
   * row-scoped member cannot reach this endpoint in the first place and
   * the D3/D9 large-transaction hold never applies to a card purchase.
   * Every role that CAN reach it (owner/member/spouse) is a trusted role
   * D9 already exempts from the hold. Substantively a card purchase IS an
   * expense — but the gate that would matter (D9's threshold) is moot here
   * by construction, not because this method special-cases it away.
   */
  async purchase(
    familyGroupId: string,
    id: string,
    dto: PurchaseLiabilityDto,
  ): Promise<LiabilityResponseDto> {
    const amount = guardBigInt("amount", dto.amount);
    if (amount <= BigInt(0)) {
      throw new BadRequestException("amount must be greater than zero");
    }

    const liability = await this.prisma.liability.findUnique({
      where: { id, familyGroupId },
    });
    if (!liability) {
      throw new NotFoundException("Liability not found");
    }

    // Tenant-scoped lookup — mirrors TransactionsService.create()'s
    // categoryId check: an unscoped lookup would let a caller link this
    // purchase to another family's category just by guessing its id.
    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId, familyGroupId },
      });
      if (!category) {
        throw new NotFoundException(`Category ${dto.categoryId} not found`);
      }
    }

    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextLiability = await tx.liability.update({
        where: { id, familyGroupId },
        data: {
          remainingBalance: { increment: amount },
          totalDebt: { increment: amount },
        },
      });

      await tx.transaction.create({
        data: {
          familyGroupId,
          // EPIC-023 E3 (D12) — no account, ever: this is the whole point.
          accountId: null,
          liabilityId: id,
          categoryId: dto.categoryId ?? null,
          amount,
          type: "expense",
          description: dto.description ?? null,
          occurredAt,
        },
      });

      return nextLiability;
    });

    return toLiabilityDto(updated);
  }

  /**
   * Finds (or, self-healing like `CategoriesService.create()`'s P2002
   * recovery, creates) a Category in this family group linked to a group-5
   * TRANSFER CoaAccount, so the principal leg of a payment always has
   * somewhere honest to post against.
   */
  private async resolvePrincipalCategoryId(
    tx: TxClient,
    familyGroupId: string,
  ): Promise<string> {
    const existing = await tx.category.findFirst({
      where: {
        familyGroupId,
        coaAccount: { groupNum: 5, direction: "TRANSFER" },
      },
      select: { id: true },
    });
    if (existing) return existing.id;

    const coaAccount = await tx.coaAccount.findFirst({
      where: { familyGroupId, groupNum: 5, direction: "TRANSFER" },
      orderBy: { code: "asc" },
    });
    if (!coaAccount) {
      throw new BadRequestException(
        "This family group has no group-5 (Account Payable) COA account provisioned",
      );
    }

    return this.createCategoryOrUseRaceWinner(tx, familyGroupId, coaAccount);
  }

  /** Same self-healing lookup as above, scoped to the loan-interest account. */
  private async resolveInterestCategoryId(
    tx: TxClient,
    familyGroupId: string,
  ): Promise<string> {
    const existing = await tx.category.findFirst({
      where: {
        familyGroupId,
        coaAccount: { code: { in: LOAN_INTEREST_COA_CODES } },
      },
      select: { id: true },
    });
    if (existing) return existing.id;

    const coaAccount = await tx.coaAccount.findFirst({
      where: { familyGroupId, code: { in: LOAN_INTEREST_COA_CODES } },
      orderBy: { code: "asc" },
    });
    if (!coaAccount) {
      throw new BadRequestException(
        "This family group has no loan-interest COA account provisioned",
      );
    }

    return this.createCategoryOrUseRaceWinner(tx, familyGroupId, coaAccount);
  }

  /**
   * EPIC-023 review follow-up — `Category` has `@@unique([familyGroupId,
   * name, kind])`. Two concurrent first-ever `pay()` calls for the same
   * family can both pass the `findFirst` self-healing check above (neither
   * category exists yet) and then race to `create()` it; the loser gets a
   * Prisma P2002.
   *
   * Unlike `CategoriesService.create()` (which maps P2002 straight to a
   * `ConflictException` and stops), this path used to try to recover by
   * re-reading the row on the SAME transaction client. That recovery is
   * impossible: once any statement inside a Postgres transaction errors,
   * Postgres marks the whole transaction aborted and rejects every
   * subsequent statement with SQLSTATE 25P02 ("current transaction is
   * aborted, commands ignored until end of transaction block") until the
   * transaction ends. Prisma's interactive `$transaction` does not wrap
   * individual queries in implicit SAVEPOINTs, so a follow-up `findFirst` on
   * `tx` after catching P2002 is guaranteed to fail — with an opaque
   * `PrismaClientUnknownRequestError`, not a P2002, so it would not even be
   * retried. Do not reintroduce an in-transaction re-read here.
   *
   * Instead, let P2002 propagate out of `runPayment()` and out of this
   * `$transaction` call entirely, rolling the whole attempt back. `pay()`'s
   * bounded retry loop treats P2002 the same as a P2034 serialization
   * failure: it re-enters `$transaction` in a fresh attempt, and that
   * attempt's `findFirst` self-heal check above now finds the winner's
   * already-committed category.
   */
  private async createCategoryOrUseRaceWinner(
    tx: TxClient,
    familyGroupId: string,
    coaAccount: { id: string; name: string },
  ): Promise<string> {
    const created = await tx.category.create({
      data: {
        familyGroupId,
        name: coaAccount.name,
        kind: "expense",
        coaAccountId: coaAccount.id,
      },
    });
    return created.id;
  }
}
