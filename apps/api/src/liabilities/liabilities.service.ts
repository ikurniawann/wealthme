import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { type Role } from "@prisma/client";

import { assertBankNotOverdrawn } from "../common/utils/bank-overdraft.util";
import { effectiveBudgetType } from "../common/utils/effective-budget-type.util";
import { ownCategoryName } from "../common/utils/own-category-name.util";
import { currentPaymentPeriodBounds } from "../common/utils/payment-period.util";
import { runSerializableWithRetry } from "../common/utils/serializable-retry.util";
import {
  NOTIFICATION_SENDER_PORT,
  type NotificationSenderPort,
} from "../notifications/notification-sender.port";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";
import {
  checkBudgetAlert,
  checkCashFlowAlert,
  notifyTransaction,
} from "../transactions/transaction-alerts.util";

import {
  buildSchedule,
  computeInstallment,
  defaultInterestMethod,
  monthsElapsed,
  rateForPeriod,
  splitPayment,
  type InterestMethod,
} from "./amortisation.util";

import type { CreateLiabilityDto } from "./dto/create-liability.dto";
import type {
  LiabilityResponseDto,
  LiabilityScheduleResponseDto,
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

// EPIC-023 group E retry (HIGH 3) — mirrors TransactionsService's own
// ActingMember shape (not imported directly, to avoid a service-to-service
// coupling for one type): the acting member's identity, used to stamp
// `createdByUserId` on a card purchase and to notify like every other
// expense-shaped write.
export type ActingMember = { id: string; userId: string; role: Role } | null;

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
  interestMethod: InterestMethod;
  tenorMonths: number | null;
  startDate: Date | null;
  installmentAmount: bigint | null;
  fixedRateMonths: number | null;
  floatingRate: { toString(): string } | null;
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
    interestMethod: liability.interestMethod,
    tenorMonths: liability.tenorMonths,
    startDate: liability.startDate?.toISOString() ?? null,
    installmentAmount: liability.installmentAmount?.toString() ?? null,
    fixedRateMonths: liability.fixedRateMonths,
    floatingRate: liability.floatingRate?.toString() ?? null,
    createdAt: liability.createdAt.toISOString(),
    updatedAt: liability.updatedAt.toISOString(),
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

function assertMethodAllowed(type: string, method: InterestMethod): void {
  if (type === "kartu_kredit" && method !== "efektif") {
    throw new BadRequestException(
      "Kartu kredit hanya mendukung metode bunga efektif",
    );
  }
}

function resolveInstallment(terms: {
  method: InterestMethod;
  totalDebt: bigint;
  interestRate: string;
  tenorMonths: number | null;
  override: bigint | undefined;
}): bigint | null {
  if (terms.method === "efektif") return null;
  if (terms.override !== undefined) return terms.override;
  if (terms.tenorMonths === null) return null;
  return computeInstallment({
    method: terms.method,
    principal: terms.totalDebt,
    annualInterestRatePercent: terms.interestRate,
    tenorMonths: terms.tenorMonths,
  });
}

// Installment k falls due k months after the akad, so a payment settles installment max(1, elapsed).
function settledPeriod(startDate: Date | null, now: Date): number {
  return startDate ? Math.max(1, monthsElapsed(startDate, now)) : 1;
}

@Injectable()
export class LiabilitiesService {
  private readonly logger = new Logger(LiabilitiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_SENDER_PORT)
    private readonly notificationSender: NotificationSenderPort,
  ) {}

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
    // Liabilities have no premiumPeriod-equivalent field — their FIXED
    // budget line is always `period: "monthly"` (syncPrincipalBudgetLine),
    // so "monthly" is the correct (and only) period here.
    const { periodStart, periodEnd } = currentPaymentPeriodBounds("monthly");
    const rows = await this.prisma.transaction.findMany({
      where: {
        familyGroupId,
        liabilityId: { in: liabilityIds },
        occurredAt: { gte: periodStart, lte: periodEnd },
        // C1 (group E retry round 4) — a card PURCHASE (`purchase()`) also
        // stamps `liabilityId`, with `type: "expense"`, same as the
        // interest leg of a real PAYMENT (`pay()`'s interest transaction is
        // also `type: "expense"`) — so `type` alone cannot tell a charge
        // apart from a payment. `accountId`, however, always can: EVERY
        // payment leg (principal `transfer` OR interest `expense`) debits
        // `sourceAccount.id` (non-null), while `purchase()` NEVER sets an
        // `accountId` at all (D12 — "a credit card stays a liability;
        // spending raises the card's debt and leaves the bank untouched").
        // Filtering on `accountId: { not: null }` therefore excludes every
        // purchase while keeping every real payment leg.
        accountId: { not: null },
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

  /** Read-only projection from the liability's current state; nothing is persisted. */
  async getSchedule(
    familyGroupId: string,
    id: string,
    now: Date = new Date(),
  ): Promise<LiabilityScheduleResponseDto> {
    const liability = await this.prisma.liability.findUnique({
      where: { id, familyGroupId },
    });
    if (!liability) {
      throw new NotFoundException("Liability not found");
    }

    const elapsed = liability.startDate
      ? monthsElapsed(liability.startDate, now)
      : 0;
    const tenor = liability.tenorMonths;
    const rows = buildSchedule({
      method: liability.interestMethod,
      remainingBalance: liability.remainingBalance,
      originalPrincipal: liability.totalDebt,
      annualInterestRatePercent: liability.interestRate.toString(),
      rateIsMonthly: liability.type === "kartu_kredit",
      installmentAmount:
        liability.installmentAmount ??
        (liability.minimumPayment > BigInt(0)
          ? liability.minimumPayment
          : null),
      remainingMonths: tenor === null ? null : Math.max(1, tenor - elapsed),
      firstPeriod: tenor === null ? elapsed + 1 : Math.min(elapsed + 1, tenor),
      fixedRateMonths: liability.fixedRateMonths,
      floatingRatePercent: liability.floatingRate?.toString() ?? null,
    });

    return {
      liabilityId: liability.id,
      interestMethod: liability.interestMethod,
      installmentAmount: liability.installmentAmount?.toString() ?? null,
      rows: rows.map((row) => ({
        period: row.period,
        installment: row.installment.toString(),
        interest: row.interest.toString(),
        principal: row.principal.toString(),
        remaining: row.remaining.toString(),
      })),
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
    const interestMethod =
      dto.interestMethod ?? defaultInterestMethod(dto.type);
    assertMethodAllowed(dto.type, interestMethod);
    const installmentAmount = resolveInstallment({
      method: interestMethod,
      totalDebt,
      interestRate: dto.interestRate ?? "0",
      tenorMonths: dto.tenorMonths ?? null,
      override: dto.installmentAmount
        ? guardBigInt("installmentAmount", dto.installmentAmount)
        : undefined,
    });
    // A fixed installment IS the monthly obligation: it drives the budget line and the Pay preset.
    const minimumPayment =
      installmentAmount ??
      (dto.minimumPayment
        ? guardBigInt("minimumPayment", dto.minimumPayment)
        : BigInt(0));

    const liability = await runSerializableWithRetry(this.prisma, (tx) =>
      this.runCreate(tx, familyGroupId, dto, {
        totalDebt,
        remainingBalance,
        minimumPayment,
        installmentAmount,
        interestMethod,
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
      installmentAmount: bigint | null;
      interestMethod: InterestMethod;
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
        interestMethod: amounts.interestMethod,
        tenorMonths: dto.tenorMonths ?? null,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        installmentAmount: amounts.installmentAmount,
        fixedRateMonths: dto.fixedRateMonths ?? null,
        floatingRate: dto.floatingRate ?? null,
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

    // HIGH 9 (group E retry round 3) — validate the SHAPE of the supplied
    // strings here (fast BadRequestException feedback), but do NOT resolve
    // the "keep existing value" fallback from this outer read. That read is
    // taken before the Serializable transaction/retry loop; if a concurrent
    // `pay()` changes `remainingBalance` between this read and the write
    // below, falling back to THIS stale value would silently overwrite the
    // payment. `runUpdate` re-reads fresh inside the (possibly retried) tx
    // and falls back to THAT value instead.
    const totalDebt = dto.totalDebt
      ? guardBigInt("totalDebt", dto.totalDebt)
      : undefined;
    const remainingBalance = dto.remainingBalance
      ? guardBigInt("remainingBalance", dto.remainingBalance)
      : undefined;
    const minimumPayment = dto.minimumPayment
      ? guardBigInt("minimumPayment", dto.minimumPayment)
      : undefined;
    const installmentAmount = dto.installmentAmount
      ? guardBigInt("installmentAmount", dto.installmentAmount)
      : undefined;

    const updated = await runSerializableWithRetry(this.prisma, (tx) =>
      this.runUpdate(tx, familyGroupId, id, dto, {
        totalDebt,
        remainingBalance,
        minimumPayment,
        installmentAmount,
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
   *
   * HIGH 9 (group E retry round 3) — `amounts` now carries `undefined` for
   * any field the caller did not explicitly supply; the fallback to "keep
   * the current value" is resolved HERE, against the freshly re-read
   * `existing`, never against a value read before this (possibly retried)
   * transaction started. A concurrent `pay()` that changed
   * `remainingBalance` between the outer `update()` read and this
   * transaction's own read is therefore never silently reverted by an
   * unrelated PATCH (e.g. one that only changes `notes`).
   */
  private async runUpdate(
    tx: TxClient,
    familyGroupId: string,
    id: string,
    dto: UpdateLiabilityDto,
    amounts: {
      totalDebt: bigint | undefined;
      remainingBalance: bigint | undefined;
      minimumPayment: bigint | undefined;
      installmentAmount: bigint | undefined;
    },
  ): Promise<LiabilityRow> {
    // Re-read fresh inside the (possibly retried) transaction — a retry
    // must never reuse a `principalCategoryId` read before the conflict.
    const existing = await tx.liability.findUniqueOrThrow({
      where: { id, familyGroupId },
    });

    const totalDebt = amounts.totalDebt ?? existing.totalDebt;
    const remainingBalance =
      amounts.remainingBalance ?? existing.remainingBalance;
    const type = dto.type ?? existing.type;
    const interestMethod = dto.interestMethod ?? existing.interestMethod;
    assertMethodAllowed(type, interestMethod);
    const tenorMonths = dto.tenorMonths ?? existing.tenorMonths;
    const resolvedInterestRate =
      dto.interestRate ?? existing.interestRate.toString();
    // Fix round 1 (Important #2) — the web edit form re-sends every term
    // field on every save, so checking DTO field PRESENCE (as before)
    // treated a no-op PATCH as "terms changed" and silently dropped a
    // user-overridden installment. Compare resolved VALUES against
    // `existing` instead; an explicit `installmentAmount` still wins below
    // regardless of whether any other term actually changed.
    const termsChanged =
      type !== existing.type ||
      interestMethod !== existing.interestMethod ||
      tenorMonths !== existing.tenorMonths ||
      resolvedInterestRate !== existing.interestRate.toString() ||
      totalDebt !== existing.totalDebt;
    const installmentAmount =
      amounts.installmentAmount !== undefined
        ? amounts.installmentAmount
        : termsChanged
          ? resolveInstallment({
              method: interestMethod,
              totalDebt,
              interestRate: resolvedInterestRate,
              tenorMonths,
              override: undefined,
            })
          : existing.installmentAmount;
    const minimumPayment =
      installmentAmount ?? amounts.minimumPayment ?? existing.minimumPayment;

    const updated = await tx.liability.update({
      where: { id, familyGroupId },
      data: {
        name: dto.name ?? existing.name,
        institution:
          dto.institution !== undefined
            ? (dto.institution ?? null)
            : existing.institution,
        type,
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
        interestMethod,
        tenorMonths,
        startDate:
          dto.startDate !== undefined
            ? dto.startDate
              ? new Date(dto.startDate)
              : null
            : existing.startDate,
        installmentAmount,
        fixedRateMonths: dto.fixedRateMonths ?? existing.fixedRateMonths,
        floatingRate: dto.floatingRate ?? existing.floatingRate,
      },
    });

    await this.syncPrincipalBudgetLine(
      tx,
      familyGroupId,
      { ...updated, principalCategoryId: existing.principalCategoryId },
      minimumPayment,
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
        budgetType: "FIXED",
      },
      // Re-derived, not incremented — this line is exclusive to this
      // liability, so its limit IS its current contribution.
      update: {
        limitAmount: contribution,
        liabilityId: liability.id,
        budgetType: "FIXED",
      },
    });
  }

  /**
   * EPIC-023 E2 (D11) — CRITICAL 2 (group E retry round 3): the previous
   * "redesigned by HIGH 4" version of this method silently `deleteMany`'d
   * the liability's budget line before deleting the liability itself — a
   * silent cascade the D11 acceptance criterion explicitly forbids
   * ("Deleting a liability is refused while its budget line exists — never
   * a silent cascade"; "refused with a message naming what blocks it").
   * Restored: a liability with a budget line refuses deletion with a
   * `ConflictException` naming the liability and its budget line. Per-
   * obligation budget rows (HIGH 4's own Category per liability) make this
   * check EXACT (never false-positives on a sibling liability's line the
   * way the pre-HIGH-4 shared-category design used to) — a liability that
   * never had a line (minimumPayment stayed 0) is still freely deletable.
   */
  async remove(familyGroupId: string, id: string): Promise<void> {
    const existing = await this.prisma.liability.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) {
      throw new NotFoundException("Liability not found");
    }

    const budget = await this.prisma.budget.findFirst({
      where: { familyGroupId, liabilityId: id },
      select: { id: true },
    });
    if (budget) {
      throw new ConflictException(
        `Tidak dapat menghapus "${existing.name}" — hapus dulu anggaran (budget) terkait (id ${budget.id})`,
      );
    }

    await this.prisma.liability.delete({ where: { id, familyGroupId } });
  }

  /**
   * CRITICAL 3 (group E retry round 3) — rejects a second payment against
   * the SAME liability within the current period. Runs inside the same
   * Serializable transaction as the balance mutation in `runPayment`, so it
   * is race-safe with itself (two concurrent `pay()` calls can't both pass
   * this check and both commit).
   */
  private async assertNotAlreadyPaidThisPeriod(
    tx: TxClient,
    familyGroupId: string,
    liabilityId: string,
    liabilityName: string,
  ): Promise<void> {
    const { periodStart, periodEnd } = currentPaymentPeriodBounds("monthly");
    const existing = await tx.transaction.findFirst({
      where: {
        familyGroupId,
        liabilityId,
        occurredAt: { gte: periodStart, lte: periodEnd },
        // C1 (group E retry round 4) — same `accountId`-based payment-leg
        // discriminator as `paidThisPeriodIds` above: without it, a card
        // PURCHASE this period (accountId always null) is indistinguishable
        // by `type` from a real payment and permanently blocks `pay()` for
        // that liability's own period, even though nothing has been paid
        // yet. See `paidThisPeriodIds`'s doc comment for the full reasoning.
        accountId: { not: null },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        `"${liabilityName}" sudah dibayar periode ini — koreksi transaksi yang ada, jangan bayar dua kali`,
      );
    }
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
    now: Date = new Date(),
  ): Promise<LiabilityResponseDto> {
    const paymentAmount = guardBigInt("amount", dto.amount);
    if (paymentAmount <= BigInt(0)) {
      throw new BadRequestException("amount must be greater than zero");
    }

    const { liability, principalCategoryId } = await runSerializableWithRetry(
      this.prisma,
      (tx) => this.runPayment(tx, familyGroupId, id, dto, paymentAmount, now),
    );

    // H5 (group E retry round 4) — `purchase()` already fired this same
    // alert for every card charge; `pay()` never did, so a FIXED line paid
    // well past its `limitAmount` showed as over-budget on `/anggaran`
    // while no 80%/100% notification ever fired for it. Fired once, AFTER
    // the transaction has committed (never inside the retry loop) — mirrors
    // `purchase()`'s own fire-and-forget placement exactly.
    if (principalCategoryId) {
      void checkBudgetAlert(
        this.prisma,
        this.notificationSender,
        familyGroupId,
        principalCategoryId,
      );
    }

    return liability;
  }

  private async runPayment(
    tx: TxClient,
    familyGroupId: string,
    id: string,
    dto: PayLiabilityDto,
    paymentAmount: bigint,
    now: Date,
  ): Promise<{
    liability: LiabilityResponseDto;
    principalCategoryId: string | null;
  }> {
    const liability = await tx.liability.findUnique({
      where: { id, familyGroupId },
    });
    if (!liability) {
      throw new NotFoundException("Liability not found");
    }

    // CRITICAL 1 (group E retry round 3) — the previous "already paid" guard
    // was a disabled BUTTON ONLY on the web page; neither this method nor
    // `InsurancesService.runPay` rejected a second payment server-side, so
    // two tabs, a stale page, a replayed request, or a direct API call could
    // all double-debit the same obligation. Enforced here, inside the SAME
    // Serializable transaction as the balance mutation, so it is race-safe
    // with itself. No override path: a genuine correction (wrong amount,
    // wrong account) is NOT made by deleting/editing the mistaken
    // Transaction row — C4 (group E retry round 4) found that path was
    // never actually safe (deleting a payment refunded the cash but left
    // `remainingBalance` reduced, permanently understating the debt) and
    // `TransactionsService.update()`/`.remove()` now REFUSE an obligation-
    // linked row outright. The real correction path: adjust THIS
    // liability's `remainingBalance`/`totalDebt` directly via `PATCH
    // .../liabilities/:id`, then edit/delete the Transaction row once the
    // liability itself is back in sync.
    await this.assertNotAlreadyPaidThisPeriod(
      tx,
      familyGroupId,
      id,
      liability.name,
    );

    // CRITICAL 3 (group E retry round 3) — a payment recorded through the
    // transaction dialog / a bank import never sets `liabilityId`, so it
    // never trips this guard. Accepted: fixing that would require inferring
    // intent from an ordinary expense row, which this task does not attempt.

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
      annualInterestRatePercent: rateForPeriod({
        period: settledPeriod(liability.startDate, now),
        baseRatePercent: liability.interestRate.toString(),
        fixedRateMonths: liability.fixedRateMonths,
        floatingRatePercent: liability.floatingRate?.toString() ?? null,
      }),
      rateIsMonthly: liability.type === "kartu_kredit",
      method: liability.interestMethod,
      originalPrincipal: liability.totalDebt,
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

    const occurredAt = now;

    // CRITICAL 3 (group E retry round 3) — `syncPrincipalBudgetLine` used to
    // only ever be called from `create()`/`update()`. `pay()` self-healed
    // `principalCategoryId` (creating a brand-new Category) but NEVER
    // created the matching Budget row, so a family that only ever presses
    // Pay never got a budget line and its payments stayed invisible to
    // every budget. Resolved ONCE here (self-healing the category the first
    // time it is needed) and reused below for both the principal-transaction
    // categoryId and the budget sync, so a concurrent self-heal race can
    // only ever create ONE category (never a second, orphaned one from a
    // second `resolveOwnPrincipalCategoryId` call further down).
    const principalCategoryId = await this.resolveOwnPrincipalCategoryId(
      tx,
      familyGroupId,
      liability,
    );
    if (liability.minimumPayment > BigInt(0)) {
      await this.syncPrincipalBudgetLine(
        tx,
        familyGroupId,
        { ...liability, principalCategoryId },
        liability.minimumPayment,
      );
    }

    if (principal > BigInt(0)) {
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
          // CRITICAL 1 (group E retry round 3) — an interest-only payment
          // (principal === 0, e.g. a payment that only covers accrued
          // interest) used to create ONLY this row, which carried no
          // `liabilityId` — `paidThisPeriod` stayed false forever for a
          // real payment, letting the same period be "paid" an unbounded
          // number of times. Linking it here means ANY payment against this
          // liability (principal, interest, or both) is recorded as a
          // payment for `paidThisPeriod` and the double-payment guard above.
          liabilityId: id,
          description: `Bunga ${liability.name}`,
          occurredAt,
        },
      });
    }

    return { liability: toLiabilityDto(updated), principalCategoryId };
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
    actingMember?: ActingMember,
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

    // HIGH 7 (group E retry round 3) — nothing previously checked
    // `liability.type`, so `POST .../liabilities/<any-id>/purchase` could
    // increment a MORTGAGE's `remainingBalance`/`totalDebt` and corrupt its
    // `paymentRatio` — the whole point of this route ("a credit card stays
    // a liability") only makes sense for a card.
    if (liability.type !== "kartu_kredit") {
      throw new BadRequestException(
        "Only a kartu_kredit (credit card) liability accepts purchases",
      );
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

    const { updated, created } = await this.prisma.$transaction(async (tx) => {
      const nextLiability = await tx.liability.update({
        where: { id, familyGroupId },
        // EPIC-033 p20 — for a card `totalDebt` is the credit LIMIT (the UI
        // labels it "Limit Kredit"); a purchase raises the running bill only.
        data: {
          remainingBalance: { increment: amount },
        },
      });

      const createdTx = await tx.transaction.create({
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
          // HIGH 8 (group E retry round 3) — was hardcoded null: no record
          // of who charged the card.
          createdByUserId: actingMember?.userId ?? null,
        },
        include: {
          category: { select: { name: true } },
          account: { select: { name: true } },
        },
      });

      return { updated: nextLiability, created: createdTx };
    });

    // HIGH 8 — a card purchase is expense-shaped and must get the SAME
    // notification/alert treatment `TransactionsService.create()` gives
    // every other expense; this used to fire none of them.
    if (dto.categoryId) {
      void checkBudgetAlert(
        this.prisma,
        this.notificationSender,
        familyGroupId,
        dto.categoryId,
      );
    }
    void checkCashFlowAlert(this.prisma, familyGroupId);
    // L9 (group E retry round 4) — mirrors `TransactionsService.create()`'s
    // own `getMemberThreshold` lookup (D3/D9): without it, a card purchase
    // always used the fixed 5,000,000 fallback `notifyTransaction` defaults
    // to, ignoring the acting member's OWN large-transaction threshold —
    // the same honest, per-member cutoff every ordinary expense already
    // gets. `?? undefined`: a `null` threshold (the normal case) falls
    // back to `notifyTransaction`'s own default, exactly like
    // TransactionsService.create() does.
    const actingMemberThreshold = actingMember
      ? await this.getMemberThreshold(actingMember.id)
      : null;
    void notifyTransaction(
      this.prisma,
      familyGroupId,
      "expense",
      amount,
      created,
      actingMemberThreshold ?? undefined,
    );

    return toLiabilityDto(updated);
  }

  /** Mirrors `TransactionsService.getMemberThreshold` (D3). */
  private async getMemberThreshold(memberId: string): Promise<bigint | null> {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: { largeTxnThreshold: true },
    });
    return member?.largeTxnThreshold ?? null;
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

    // HIGH 10 (group E retry round 3b) — this liability is about to be
    // SPLIT OUT of whatever category its past principal payments were
    // posted against into its own, brand-new category. If that PRIOR
    // category still carries a FIXED budget line, that line's `limitAmount`
    // was very likely set (pre-this-feature) to cover MULTIPLE liabilities'
    // combined `minimumPayment` (the old "one shared cicilan-pokok line"
    // design `create()`'s doc comment describes) — this liability's own
    // NEW line (below) adds its contribution a SECOND time, on top of the
    // still-unchanged shared line, permanently inflating the family's total
    // budgeted limit. There is no way to safely subtract "this liability's
    // share" from that shared line from the data available (it was never
    // recorded per-liability), so — per this task's guidance — this is
    // detected and surfaced LOUDLY (a Logger.warn plus a persisted
    // Notification) instead of silently guessed at.
    await this.warnIfPriorSharedBudgetLine(tx, familyGroupId, liability);

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

  /**
   * HIGH 10 (group E retry round 3b) — finds the categoryId this
   * liability's own PAST principal payments (if any) were posted against
   * BEFORE this self-heal, and warns loudly (log + persisted Notification)
   * when that category still carries a FIXED budget line — see
   * `resolveOwnPrincipalCategoryId`'s doc comment for the full reasoning.
   * A brand-new liability with no prior "transfer" payment has nothing to
   * warn about and this is a silent no-op for it.
   *
   * C3 (group E retry round 4) — this used to be structurally unable to
   * ever fire, for two independent reasons, both fixed here:
   *
   * 1. It matched PRIOR payments only via `liabilityId: liability.id` —
   *    but `liabilityId` (E1) is a column THIS EPIC added and never
   *    backfilled onto pre-existing rows. A liability that predates E1 has
   *    payments with `liabilityId: null` no matter how many times it was
   *    paid, so this always returned nothing for exactly the families this
   *    warning exists to protect. `pay()`'s principal-leg description has
   *    always been `Pembayaran pokok ${liability.name}` — unchanged since
   *    before `liabilityId` even existed as a column (see git history) —
   *    so matching on it too finds the prior category without depending on
   *    a column that was never backfilled.
   * 2. It filtered `budget.budgetType: "FIXED"` directly — `budgetType`
   *    (MEDIUM 12) is ALSO never backfilled, so every pre-existing FIXED
   *    line reads `budgetType: null` here too. `effectiveBudgetType`
   *    (shared with `BudgetsService.toDto`, C2) falls back to the
   *    category's CoaAccount `budgetType` instead of filtering it out of
   *    the query entirely — the exact same resolution `/anggaran` uses to
   *    decide a line is FIXED, so this warning and the page it warns about
   *    can never disagree.
   */
  private async warnIfPriorSharedBudgetLine(
    tx: TxClient,
    familyGroupId: string,
    liability: { id: string; name: string },
  ): Promise<void> {
    const priorPayment = await tx.transaction.findFirst({
      where: {
        familyGroupId,
        type: "transfer",
        OR: [
          { liabilityId: liability.id },
          { description: `Pembayaran pokok ${liability.name}` },
        ],
      },
      select: { categoryId: true },
      orderBy: { occurredAt: "desc" },
    });
    if (!priorPayment?.categoryId) return;

    const priorSharedBudget = await tx.budget.findFirst({
      where: { familyGroupId, categoryId: priorPayment.categoryId },
      select: {
        id: true,
        limitAmount: true,
        budgetType: true,
        category: { select: { coaAccount: { select: { budgetType: true } } } },
      },
    });
    if (!priorSharedBudget) return;
    if (effectiveBudgetType(priorSharedBudget) !== "FIXED") return;

    this.logger.warn(
      `HIGH 10: liability "${liability.name}" (${liability.id}) is being split into its own principal category, but its prior category still carries a FIXED budget line (budget ${priorSharedBudget.id}, limit ${priorSharedBudget.limitAmount.toString()}) that may still include this liability's contribution — the family's total budgeted limit may now be double-counted. This cannot be safely auto-corrected from the data available; review this family's budgets manually.`,
    );

    await tx.notification.create({
      data: {
        familyGroupId,
        title: "Perhatian: kemungkinan anggaran cicilan ganda",
        body: `"${liability.name}" baru saja mendapat kategori anggaran sendiri, tapi anggaran lama (id ${priorSharedBudget.id}) masih memiliki batas tetap yang mungkin masih menghitung kontribusi cicilan ini. Silakan tinjau anggaran keluarga Anda.`,
        icon: "⚠️",
      },
    });
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
