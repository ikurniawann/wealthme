import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { assertBankNotOverdrawn } from "../common/utils/bank-overdraft.util";
import { ownCategoryName } from "../common/utils/own-category-name.util";
import { runSerializableWithRetry } from "../common/utils/serializable-retry.util";
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
// both charts without hardcoding one over the other. UNCHANGED — the
// interest leg is a real expense shared across every liability in a family,
// it never gets a budget line, so it does not need the per-obligation
// treatment `principalCategoryId` gets below (group E retry, HIGH 4).
const LOAN_INTEREST_COA_CODES = ["20009", "21304"];

type TxClient = Parameters<Parameters<PrismaService["$transaction"]>[0]>[0];

type LiabilityRow = {
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
  principalCategoryId?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toLiabilityDto(
  liability: LiabilityRow,
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
   * EPIC-023 E2 (D11, US-LIAB-3), redesigned by the group E retry (HIGH 4)
   * — creating a liability with a non-zero `minimumPayment` auto-creates
   * this liability's OWN FIXED budget line. `minimumPayment === 0`
   * liabilities (e.g. 0% family loans with no scheduled payment)
   * intentionally get NO budget line — there is nothing due to budget for
   * yet; `update()` creates one later if `minimumPayment` goes non-zero.
   *
   * ONE BUDGET LINE PER LIABILITY (HIGH 4 fix) — every liability used to
   * share ONE family-wide "cicilan pokok" category+budget row (via
   * `increment`), which meant `Budget.liabilityId` only ever pointed at the
   * FIRST liability that seeded it, `remove()` could not tell one
   * liability's contribution apart from another's, and `limitAmount` never
   * shrank. Each liability now gets its OWN `Category`
   * (`principalCategoryId`, self-healed by `resolveOwnPrincipalCategoryId`)
   * pointing at the SAME group-5 (Account Payable) TRANSFER `CoaAccount`
   * `pay()` already posts the principal leg against — this is deliberate,
   * not incidental: `BudgetsService` computes `spentAmount` by grouping
   * `Transaction` rows on `categoryId` (EPIC-022 A6), so giving each
   * liability its own category is what makes its `spentAmount` track only
   * ITS OWN payments, `remove()` exact, and `limitAmount` re-derivable.
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

    const liability = await runSerializableWithRetry(this.prisma, (tx) =>
      this.runCreate(tx, familyGroupId, dto, {
        totalDebt,
        remainingBalance,
        minimumPayment,
      }),
    );

    return toLiabilityDto(liability);
  }

  private async runCreate(
    tx: TxClient,
    familyGroupId: string,
    dto: CreateLiabilityDto,
    amounts: {
      totalDebt: bigint;
      remainingBalance: bigint;
      minimumPayment: bigint;
    },
  ): Promise<LiabilityRow> {
    const created = await tx.liability.create({
      data: {
        familyGroupId,
        name: dto.name,
        institution: dto.institution ?? null,
        type: dto.type,
        totalDebt: amounts.totalDebt,
        remainingBalance: amounts.remainingBalance,
        minimumPayment: amounts.minimumPayment,
        interestRate: dto.interestRate ?? "0",
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        autoAdvanceDueDate: dto.autoAdvanceDueDate ?? false,
        notes: dto.notes ?? null,
        currency: dto.currency ?? "IDR",
      },
    });

    if (amounts.minimumPayment > BigInt(0)) {
      await this.syncPrincipalBudgetLine(
        tx,
        familyGroupId,
        created,
        amounts.minimumPayment,
      );
    }

    return created;
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

    const updated = await runSerializableWithRetry(this.prisma, (tx) =>
      this.runUpdate(tx, familyGroupId, id, dto, {
        totalDebt,
        remainingBalance,
        minimumPayment,
      }),
    );

    return toLiabilityDto(updated);
  }

  /**
   * HIGH 4 fix — `minimumPayment` going 0 -> non-zero now actually creates a
   * budget line (previously created NOTHING, silently), non-zero -> 0
   * REMOVES this liability's line instead of leaving it inflated forever,
   * and any other change re-derives `limitAmount` to the NEW contribution
   * via a plain `update` (never `increment`) — the old code only ever grew
   * `limitAmount`, it never shrank or resynced it.
   */
  private async runUpdate(
    tx: TxClient,
    familyGroupId: string,
    id: string,
    dto: UpdateLiabilityDto,
    amounts: {
      totalDebt: bigint;
      remainingBalance: bigint;
      minimumPayment: bigint;
    },
  ): Promise<LiabilityRow> {
    // Re-read fresh inside the (possibly retried) transaction — a retry
    // must never reuse a `principalCategoryId` read before the conflict.
    const existing = await tx.liability.findUniqueOrThrow({
      where: { id, familyGroupId },
    });

    const updated = await tx.liability.update({
      where: { id, familyGroupId },
      data: {
        name: dto.name ?? existing.name,
        institution:
          dto.institution !== undefined
            ? (dto.institution ?? null)
            : existing.institution,
        type: dto.type ?? existing.type,
        totalDebt: amounts.totalDebt,
        remainingBalance: amounts.remainingBalance,
        minimumPayment: amounts.minimumPayment,
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

    await this.syncPrincipalBudgetLine(
      tx,
      familyGroupId,
      { ...updated, principalCategoryId: existing.principalCategoryId },
      amounts.minimumPayment,
    );

    return updated;
  }

  /**
   * Creates, re-derives, or removes this liability's OWN FIXED budget line
   * so `limitAmount` always equals ITS current `minimumPayment` — see
   * `create()`'s doc comment for the full HIGH 4 design.
   */
  private async syncPrincipalBudgetLine(
    tx: TxClient,
    familyGroupId: string,
    liability: LiabilityRow,
    contribution: bigint,
  ): Promise<void> {
    if (contribution <= BigInt(0)) {
      // 0 (or reduced to 0): this liability no longer needs a budget line.
      // Deleting (not merely decrementing to 0) is safe now that the line
      // is exclusive to this liability — nothing else shares it.
      await tx.budget.deleteMany({
        where: { familyGroupId, liabilityId: liability.id },
      });
      return;
    }

    const categoryId = await this.resolveOwnPrincipalCategoryId(
      tx,
      familyGroupId,
      liability,
    );
    await this.markCategoryFixed(tx, categoryId);
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
        liabilityId: liability.id,
      },
      // Re-derived, not incremented — this line is exclusive to this
      // liability, so its limit IS its current contribution.
      update: { limitAmount: contribution, liabilityId: liability.id },
    });
  }

  /**
   * EPIC-023 E2 (D11) redesigned by the group E retry (HIGH 4) — deletes
   * this liability's OWN budget line (now exclusive to it, never shared)
   * and the liability itself in one transaction, instead of the old 409
   * "delete your shared budget first" block that made every liability
   * sharing a category undeletable until the user found and deleted a
   * budget line that also covered every OTHER liability.
   */
  async remove(familyGroupId: string, id: string): Promise<void> {
    const existing = await this.prisma.liability.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) {
      throw new NotFoundException("Liability not found");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.budget.deleteMany({
        where: { familyGroupId, liabilityId: id },
      });
      await tx.liability.delete({ where: { id, familyGroupId } });
    });
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
   * Records a payment against a liability: splits it into principal and
   * interest (EPIC-023 A2 — `splitPayment`), debits the source account by
   * the full payment, reduces `remainingBalance` by the principal only, and
   * posts the principal against THIS LIABILITY'S OWN group-5 TRANSFER
   * category (HIGH 4 — was a family-shared category) and the interest
   * (when non-zero) against the loan-interest EXPENSE category (still
   * shared — it never gets a budget line, see `LOAN_INTEREST_COA_CODES`'s
   * comment). Everything happens inside one `$transaction` so a failure
   * never leaves the account debited without the liability/ledger updated,
   * or vice versa.
   *
   * EPIC-023 review follow-up — a plain (default READ COMMITTED)
   * `$transaction` is NOT enough here: `liability.remainingBalance` and the
   * `maxPayable` guard were both derived from a read taken at the top of the
   * transaction, so two concurrent `pay()` calls could each read the same
   * balance, each compute a valid-looking principal/maxPayable, and both
   * commit — under-reducing the balance while jointly overpaying past what
   * either payment alone would have allowed. `runSerializableWithRetry`
   * (extracted from this method, group E retry HIGH 2) runs the transaction
   * at Serializable isolation with a bounded retry so the loser re-reads
   * the now-current balance and recomputes correctly instead of surfacing
   * a raw 500 for what is, from the user's point of view, a transient
   * conflict. The same retry also covers P2002 from the category self-heal
   * race — see that helper's doc comment for the full mechanism.
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

    return runSerializableWithRetry(this.prisma, (tx) =>
      this.runPayment(tx, familyGroupId, id, dto, paymentAmount),
    );
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
      const principalCategoryId = await this.resolveOwnPrincipalCategoryId(
        tx,
        familyGroupId,
        liability,
      );
      // EPIC-023 E1 — the principal leg is money moving from cash into
      // paying down debt, not a real expense (the group-5 TRANSFER category
      // above already excludes it from P&L via txCoaDirection's
      // category-first rule — see reports.service.spec.ts's A3 tests).
      // `liabilityId` links this row back to the obligation it settles
      // (D10, US-LIAB-4).
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
   * Finds this liability's OWN principal Category — self-healing (creating
   * it, group-5 TRANSFER CoaAccount) the first time it is needed — HIGH 4
   * redesign, see `create()`'s doc comment. The category name bakes in the
   * liability's own id, so two DIFFERENT liabilities can never collide on
   * name even if they share a display name; the only remaining collision
   * is two concurrent calls self-healing the SAME liability's category,
   * which `runSerializableWithRetry`'s P2002 handling covers.
   */
  private async resolveOwnPrincipalCategoryId(
    tx: TxClient,
    familyGroupId: string,
    liability: {
      id: string;
      name: string;
      principalCategoryId?: string | null;
    },
  ): Promise<string> {
    if (liability.principalCategoryId) return liability.principalCategoryId;

    const coaAccount = await tx.coaAccount.findFirst({
      where: { familyGroupId, groupNum: 5, direction: "TRANSFER" },
      orderBy: { code: "asc" },
    });
    if (!coaAccount) {
      throw new BadRequestException(
        "This family group has no group-5 (Account Payable) COA account provisioned",
      );
    }

    const category = await tx.category.create({
      data: {
        familyGroupId,
        name: ownCategoryName(coaAccount.name, liability.name, liability.id),
        kind: "expense",
        coaAccountId: coaAccount.id,
      },
    });

    await tx.liability.update({
      where: { id: liability.id, familyGroupId },
      data: { principalCategoryId: category.id },
    });

    return category.id;
  }

  /** Same self-healing lookup as `pay()` always used, scoped to the loan-interest account. */
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
