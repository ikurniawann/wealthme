import { Injectable } from "@nestjs/common";
import { CoaDirection } from "@prisma/client";

import { txCoaDirection } from "../common/utils/coa-classify.util";
import { investmentPositionValue } from "../common/utils/investment-value.util";
import {
  accountPrivacyWhere,
  nestedTransactionCategoryPrivacyWhere,
  transactionPrivacyWhere,
} from "../common/utils/privacy.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type {
  BalanceSheetDto,
  BankReportDto,
  CashflowStatementDto,
  CategoryBreakdownItem,
  CoaMatrixDto,
  DetailReportDto,
  PeriodPoint,
  PnlDto,
  ReconciliationBridgeDto,
  ReportPeriod,
  ReportSummaryDto,
  SankeyDto,
} from "@wealthme/contracts";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

function growthRate(current: number, previous: number): number {
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 100 * 10) / 10;
}

function buildCategoryBreakdown(
  byCategory: Map<string, { amount: number; color: string | null }>,
  total: number,
): CategoryBreakdownItem[] {
  return Array.from(byCategory.entries())
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([name, { amount, color }]) => ({
      categoryName: name,
      amount,
      percentage: total > 0 ? Math.round((amount / total) * 100 * 10) / 10 : 0,
      color,
    }));
}

// EPIC-023 B3 (rewrite, attempt 3) — COA group 3 ("Wealth Allocation",
// default-coa-chart.ts) is the TRANSFER-classified group a family uses to
// move cash into a wealth vehicle (savings/investment/emergency fund/other).
// A `Transaction` has no FK to the `Asset`/`Investment` row it funds, so
// `getReconciliationBridge` cannot and does not attempt an asset-vs-
// investment split (attempt 2's `code === "30002"` discriminator misfiled
// every OTHER group-3 code). EPIC-023 Task B3 review (LOW, batch fix 6) —
// corrected count: the chart every REAL family is provisioned from
// (`GENERIC_COA_CHART`, re-exported by `default-coa-chart.ts`) has FOUR
// group-3 codes (30001/30002/30003/30099); "ten" is only true of the demo
// `prisma/seed.ts`, which real families never receive — 4 misfiled codes is
// still the argument against that discriminator. Every group-3 account
// counts toward ONE combined `contribution` figure, regardless of its code.
const WEALTH_ALLOCATION_GROUP_NUM = 3;

/**
 * Signed cash effect of a group-3 "Wealth Allocation" TRANSFER, so
 * `contribution` (`getReconciliationBridge`) reflects whether cash actually
 * left or returned — attempt 2's CRITICAL 1 defect ignored this and always
 * added the amount, so a withdrawal back to cash broke the identity by
 * DOUBLE the withdrawn amount instead of correctly reducing it.
 *
 * The sign comes from `tx.type`/`toAccountId` (the transaction's real cash
 * effect), never from the category's COA direction: every group-3 category
 * is TRANSFER-classified regardless of which way money moved, so direction
 * alone carries no sign.
 *   - `expense`, or a legacy one-sided `transfer` (`toAccountId` null) —
 *     cash left the family's cash accounts: +amount.
 *   - `income` — cash came BACK to a cash account (a withdrawal): −amount.
 *   - a real two-sided `transfer` (`toAccountId` set) — both the source and
 *     destination are `Account` rows already inside `totalCash`, so net
 *     cash is unchanged and nothing was allocated to a holding: 0.
 */
function wealthAllocationCashEffect(
  tx: { type: "income" | "expense" | "transfer"; toAccountId: string | null },
  amount: number,
): number {
  if (tx.type === "income") return -amount;
  if (tx.type === "transfer") return tx.toAccountId === null ? amount : 0;
  return amount; // expense
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(
    familyGroupId: string,
    period: ReportPeriod,
    months: number,
    canSeePrivate: boolean,
    /**
     * Anchor date for the trailing-months window (defaults to now). Passing a
     * past date lets a caller re-query the same trend "as of" a selected
     * month/year instead of always ending at the real current date.
     */
    anchor: Date = new Date(),
    /**
     * Exact start of the selected range. With it, the window is
     * [rangeStart, anchor] and `months` is ignored: totals and categories
     * cover exactly the range the other report tabs (bank, detail, P&L) use,
     * instead of snapping to whole calendar months, which made the same
     * period show two different income/expense totals across tabs.
     */
    rangeStart?: Date,
  ): Promise<ReportSummaryDto> {
    // `period: "yearly"` used to be accepted and stored on the response but
    // never actually changed the bucketing below — every period bucketed by
    // MONTH regardless, so "Laporan Tahunan" (a chart literally titled "Tren
    // Pemasukan per Tahun" — income trend BY YEAR) rendered 3 individual
    // months mislabeled as years. Route it to real calendar-year buckets
    // instead; `months` is reinterpreted as "years back" for this period
    // only (the controller already clamps it to [1, 24], so at most 24
    // years — plenty for "per tahun").
    if (period === "yearly") {
      return this.getYearlySummary(
        familyGroupId,
        months,
        canSeePrivate,
        anchor,
      );
    }
    const now = anchor;
    if (rangeStart) {
      months =
        (now.getFullYear() - rangeStart.getFullYear()) * 12 +
        (now.getMonth() - rangeStart.getMonth()) +
        1;
    }
    const startDate = rangeStart
      ? new Date(rangeStart)
      : new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
    if (!rangeStart) startDate.setHours(0, 0, 0, 0);
    // EPIC-022 finding 5 — bound the query to the same trailing-months
    // window `monthKeys` builds below (through the end of `anchor`'s
    // month). `totalIncome`/`totalExpense`/`points` were already implicitly
    // bounded (they only read `monthKeys`-matching buckets), but
    // `incomeByCat`/`expenseByCat` below accumulate every matching
    // transaction unconditionally — without this upper bound they silently
    // included every transaction from `startDate` through the real "now",
    // even when `anchor` is a historical date (EPIC-022 B6 threads a past
    // `endDate` into this as the anchor for exports): a March export's
    // headline total would be correct, but its category breakdown would
    // leak April-onward data.
    const endDate = rangeStart
      ? new Date(now)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0);
    if (!rangeStart) endDate.setHours(23, 59, 59, 999);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        familyGroupId,
        occurredAt: { gte: startDate, lte: endDate },
        ...transactionPrivacyWhere(canSeePrivate),
      },
      select: {
        amount: true,
        type: true,
        occurredAt: true,
        category: {
          select: {
            name: true,
            color: true,
            coaAccount: { select: { direction: true } },
          },
        },
      },
    });

    // Build month keys for the range
    const monthKeys: string[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      );
    }

    const incomeByMonth = new Map<string, number>(monthKeys.map((k) => [k, 0]));
    const expenseByMonth = new Map<string, number>(
      monthKeys.map((k) => [k, 0]),
    );
    const incomeByCat = new Map<
      string,
      { amount: number; color: string | null }
    >();
    const expenseByCat = new Map<
      string,
      { amount: number; color: string | null }
    >();

    for (const tx of transactions) {
      const key = `${tx.occurredAt.getFullYear()}-${String(tx.occurredAt.getMonth() + 1).padStart(2, "0")}`;
      const amount = Number(tx.amount);
      const catName = tx.category?.name ?? "Lainnya";
      const catColor = tx.category?.color ?? null;
      const dir = txCoaDirection(tx);

      if (dir === CoaDirection.INCOME) {
        incomeByMonth.set(key, (incomeByMonth.get(key) ?? 0) + amount);
        const existing = incomeByCat.get(catName) ?? {
          amount: 0,
          color: catColor,
        };
        incomeByCat.set(catName, {
          amount: existing.amount + amount,
          color: catColor,
        });
      } else if (dir === CoaDirection.EXPENSE) {
        expenseByMonth.set(key, (expenseByMonth.get(key) ?? 0) + amount);
        const existing = expenseByCat.get(catName) ?? {
          amount: 0,
          color: catColor,
        };
        expenseByCat.set(catName, {
          amount: existing.amount + amount,
          color: catColor,
        });
      }
    }

    const points: PeriodPoint[] = monthKeys.map((k) => {
      const [, m] = k.split("-");
      const income = incomeByMonth.get(k) ?? 0;
      const expense = expenseByMonth.get(k) ?? 0;
      return {
        label: MONTH_LABELS[parseInt(m ?? "1", 10) - 1] ?? k,
        income,
        expense,
        net: income - expense,
      };
    });

    const totalIncome = points.reduce((s, p) => s + p.income, 0);
    const totalExpense = points.reduce((s, p) => s + p.expense, 0);
    const netSavings = totalIncome - totalExpense;
    const savingsRate =
      totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

    return {
      period,
      points,
      totalIncome,
      totalExpense,
      netSavings,
      savingsRate,
      topIncomeCategories: buildCategoryBreakdown(
        incomeByCat,
        totalIncome,
      ).slice(0, 5),
      topExpenseCategories: buildCategoryBreakdown(
        expenseByCat,
        totalExpense,
      ).slice(0, 5),
    };
  }

  /** `getSummary`'s calendar-year-bucketed counterpart — see the comment at
   * its `period === "yearly"` branch for why this exists as a separate
   * method instead of a month/year switch woven through the same loop
   * (the month-key and year-key bucketing differ enough — `MONTH_LABELS`
   * lookup vs. a plain year number — that sharing one function would need
   * more branching than just keeping them apart). `years` mirrors `months`'
   * existing [1, 24] clamp from the controller. */
  private async getYearlySummary(
    familyGroupId: string,
    years: number,
    canSeePrivate: boolean,
    anchor: Date,
  ): Promise<ReportSummaryDto> {
    const endYear = anchor.getFullYear();
    const startYear = endYear - (years - 1);
    const startDate = new Date(startYear, 0, 1, 0, 0, 0, 0);
    const endDate = new Date(anchor);
    endDate.setHours(23, 59, 59, 999);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        familyGroupId,
        occurredAt: { gte: startDate, lte: endDate },
        ...transactionPrivacyWhere(canSeePrivate),
      },
      select: {
        amount: true,
        type: true,
        occurredAt: true,
        category: {
          select: {
            name: true,
            color: true,
            coaAccount: { select: { direction: true } },
          },
        },
      },
    });

    const yearKeys: number[] = [];
    for (let y = startYear; y <= endYear; y += 1) yearKeys.push(y);

    const incomeByYear = new Map<number, number>(yearKeys.map((y) => [y, 0]));
    const expenseByYear = new Map<number, number>(yearKeys.map((y) => [y, 0]));
    const incomeByCat = new Map<
      string,
      { amount: number; color: string | null }
    >();
    const expenseByCat = new Map<
      string,
      { amount: number; color: string | null }
    >();

    for (const tx of transactions) {
      const year = tx.occurredAt.getFullYear();
      const amount = Number(tx.amount);
      const catName = tx.category?.name ?? "Lainnya";
      const catColor = tx.category?.color ?? null;
      const dir = txCoaDirection(tx);

      if (dir === CoaDirection.INCOME) {
        incomeByYear.set(year, (incomeByYear.get(year) ?? 0) + amount);
        const existing = incomeByCat.get(catName) ?? {
          amount: 0,
          color: catColor,
        };
        incomeByCat.set(catName, {
          amount: existing.amount + amount,
          color: catColor,
        });
      } else if (dir === CoaDirection.EXPENSE) {
        expenseByYear.set(year, (expenseByYear.get(year) ?? 0) + amount);
        const existing = expenseByCat.get(catName) ?? {
          amount: 0,
          color: catColor,
        };
        expenseByCat.set(catName, {
          amount: existing.amount + amount,
          color: catColor,
        });
      }
    }

    const points: PeriodPoint[] = yearKeys.map((y) => {
      const income = incomeByYear.get(y) ?? 0;
      const expense = expenseByYear.get(y) ?? 0;
      return { label: String(y), income, expense, net: income - expense };
    });

    const totalIncome = points.reduce((s, p) => s + p.income, 0);
    const totalExpense = points.reduce((s, p) => s + p.expense, 0);
    const netSavings = totalIncome - totalExpense;
    const savingsRate =
      totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

    return {
      period: "yearly",
      points,
      totalIncome,
      totalExpense,
      netSavings,
      savingsRate,
      topIncomeCategories: buildCategoryBreakdown(
        incomeByCat,
        totalIncome,
      ).slice(0, 5),
      topExpenseCategories: buildCategoryBreakdown(
        expenseByCat,
        totalExpense,
      ).slice(0, 5),
    };
  }

  async getBankReport(
    familyGroupId: string,
    startDate: Date,
    endDate: Date,
    canSeePrivate: boolean,
  ): Promise<BankReportDto> {
    const accounts = await this.prisma.account.findMany({
      where: { familyGroupId, ...accountPrivacyWhere(canSeePrivate) },
      select: {
        id: true,
        name: true,
        institution: true,
        balance: true,
        transactions: {
          where: {
            occurredAt: { gte: startDate, lte: endDate },
            ...nestedTransactionCategoryPrivacyWhere(canSeePrivate),
          },
          select: {
            amount: true,
            type: true,
            category: {
              select: { coaAccount: { select: { direction: true } } },
            },
          },
        },
      },
    });

    let totalIncome = 0;
    let totalExpense = 0;

    // EPIC-017 consistency: classify by COA direction (matches Ringkasan/PNL/
    // Arus Kas), not tx.type — TRANSFER-mapped transactions are excluded.
    const banks = accounts.map((acc) => {
      const income = acc.transactions
        .filter((t) => txCoaDirection(t) === CoaDirection.INCOME)
        .reduce((s, t) => s + Number(t.amount), 0);
      const expense = acc.transactions
        .filter((t) => txCoaDirection(t) === CoaDirection.EXPENSE)
        .reduce((s, t) => s + Number(t.amount), 0);

      totalIncome += income;
      totalExpense += expense;

      return {
        accountName: acc.name,
        institution: acc.institution,
        income,
        expense,
        balance: Number(acc.balance),
      };
    });

    return {
      period: "monthly",
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      banks,
      totalIncome,
      totalExpense,
    };
  }

  async getDetailReport(
    familyGroupId: string,
    startDate: Date,
    endDate: Date,
    canSeePrivate: boolean,
  ): Promise<DetailReportDto> {
    const txs = await this.prisma.transaction.findMany({
      where: {
        familyGroupId,
        occurredAt: { gte: startDate, lte: endDate },
        ...transactionPrivacyWhere(canSeePrivate),
      },
      select: {
        id: true,
        occurredAt: true,
        description: true,
        type: true,
        amount: true,
        category: {
          select: {
            name: true,
            coaAccount: { select: { direction: true } },
          },
        },
        account: { select: { name: true } },
      },
      // occurredAt is date-only, so same-day entries tie — createdAt
      // breaks the tie so the most recently added transaction is first.
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    });

    let totalIncome = 0;
    let totalExpense = 0;

    // EPIC-017 consistency: totals classify by COA direction (matches
    // Ringkasan/PNL/Arus Kas); the per-row `type` field below still reflects
    // the transaction's own recorded type for display.
    const transactions = txs.map((tx) => {
      const amount = Number(tx.amount);
      const dir = txCoaDirection(tx);
      if (dir === CoaDirection.INCOME) totalIncome += amount;
      else if (dir === CoaDirection.EXPENSE) totalExpense += amount;

      return {
        id: tx.id,
        occurredAt: tx.occurredAt.toISOString(),
        description: tx.description ?? null,
        categoryName: tx.category?.name ?? null,
        // EPIC-023 E3 (D12) — a credit-card purchase has no account.
        accountName: tx.account?.name ?? null,
        type: tx.type as "income" | "expense" | "transfer",
        amount,
      };
    });

    return {
      period: "monthly",
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      transactions,
      totalIncome,
      totalExpense,
      count: transactions.length,
    };
  }

  async getPnl(
    familyGroupId: string,
    startDate: Date,
    endDate: Date,
    canSeePrivate: boolean,
  ): Promise<PnlDto> {
    const durationMs = endDate.getTime() - startDate.getTime();
    const prevEnd = new Date(startDate.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - durationMs);

    const [currentTxs, prevTxs] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          familyGroupId,
          occurredAt: { gte: startDate, lte: endDate },
          ...transactionPrivacyWhere(canSeePrivate),
        },
        select: {
          amount: true,
          type: true,
          category: {
            select: {
              name: true,
              color: true,
              coaAccount: { select: { direction: true } },
            },
          },
        },
      }),
      this.prisma.transaction.findMany({
        where: {
          familyGroupId,
          occurredAt: { gte: prevStart, lte: prevEnd },
          ...transactionPrivacyWhere(canSeePrivate),
        },
        select: {
          amount: true,
          type: true,
          category: { select: { coaAccount: { select: { direction: true } } } },
        },
      }),
    ]);

    const revenueByCategory = new Map<
      string,
      { amount: number; color: string | null }
    >();
    const expenseByCategory = new Map<
      string,
      { amount: number; color: string | null }
    >();
    let revenue = 0;
    let expenses = 0;

    for (const tx of currentTxs) {
      const amount = Number(tx.amount);
      const catName = tx.category?.name ?? "Lainnya";
      const catColor = tx.category?.color ?? null;

      const dir = txCoaDirection(tx);
      if (dir === CoaDirection.INCOME) {
        revenue += amount;
        const existing = revenueByCategory.get(catName) ?? {
          amount: 0,
          color: catColor,
        };
        revenueByCategory.set(catName, {
          amount: existing.amount + amount,
          color: catColor,
        });
      } else if (dir === CoaDirection.EXPENSE) {
        expenses += amount;
        const existing = expenseByCategory.get(catName) ?? {
          amount: 0,
          color: catColor,
        };
        expenseByCategory.set(catName, {
          amount: existing.amount + amount,
          color: catColor,
        });
      }
    }

    let previousRevenue = 0;
    let previousExpenses = 0;
    for (const tx of prevTxs) {
      const amount = Number(tx.amount);
      const dir = txCoaDirection(tx);
      if (dir === CoaDirection.INCOME) previousRevenue += amount;
      else if (dir === CoaDirection.EXPENSE) previousExpenses += amount;
    }

    const netProfit = revenue - expenses;
    const previousNetProfit = previousRevenue - previousExpenses;

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      revenue,
      expenses,
      netProfit,
      previousRevenue,
      previousExpenses,
      previousNetProfit,
      revenueGrowth: growthRate(revenue, previousRevenue),
      expenseGrowth: growthRate(expenses, previousExpenses),
      profitGrowth: growthRate(netProfit, previousNetProfit),
      revenueBreakdown: buildCategoryBreakdown(revenueByCategory, revenue),
      expenseBreakdown: buildCategoryBreakdown(expenseByCategory, expenses),
    };
  }

  /**
   * EPIC-023 B2 (closes EPIC-022 B11) — `asOfDate` used to be accepted but
   * ignored: every figure below was always the CURRENT live balance, no
   * matter which date was requested. This now reads the daily
   * `NetWorthSnapshot` aggregate for the requested range's end date (or the
   * most recent one on or before it — never a later one), so picking "last
   * month" actually shows last month's figures.
   *
   * `NetWorthSnapshot` only stores family-wide TOTALS (no itemized
   * per-account/asset/liability breakdown, and no per-viewer privacy
   * dimension — see net-worth-snapshot's own "family-wide totals" note), so
   * the snapshot-driven branch below can only report bucket totals, not the
   * itemized `items` a live query can. Two honest fallbacks, in order:
   *   1. A snapshot exists on/before `asOfDate` → use it (bucket totals only).
   *   2. No snapshot exists on/before it, but the family HAS snapshot
   *      history (just not this far back) → report `dataAvailable: false`
   *      rather than a zero that looks like a real (empty) balance sheet.
   *   3. The family has captured NO snapshot at all yet (e.g. brand new,
   *      before the nightly capture has run even once) → fall back to the
   *      previous LIVE, privacy-scoped computation so the balance sheet
   *      still works on day one; `isHistorical: false` discloses that these
   *      are current balances, not a true point-in-time statement.
   *   4. EPIC-023 Task B retry (CRITICAL 2) — a snapshot on/before
   *      `asOfDate` DOES exist, but it was captured with privacy fully open
   *      (`captureSnapshot` always calls `computeNetWorthBreakdown(...,
   *      true)`) and this viewer may NOT see private items. Showing it
   *      would leak every private account's balance to a plain `member`.
   *      When the family has at least one private account, refuse the
   *      snapshot outright — `restrictedForViewer: true`, zeroed out, same
   *      as the "no data" shape above — rather than silently substituting a
   *      live (but still privacy-unaware) figure.
   */
  async getBalanceSheet(
    familyGroupId: string,
    asOfDate: Date,
    canSeePrivate: boolean,
  ): Promise<BalanceSheetDto> {
    // A range that ends today (or later) asks for the position NOW. The
    // daily snapshot is captured once at 02:00 and never refreshed, so it
    // lagged every balance change made since — the balance sheet disagreed
    // with the live net worth on Beranda and Grup Keluarga. Snapshots are
    // for past dates only.
    if (asOfDate.getTime() >= Date.now()) {
      return this.computeLiveBalanceSheet(
        familyGroupId,
        asOfDate,
        canSeePrivate,
      );
    }
    const snapshot = await this.prisma.netWorthSnapshot.findFirst({
      where: { familyGroupId, date: { lte: asOfDate } },
      orderBy: { date: "desc" },
    });
    if (snapshot) {
      if (
        !canSeePrivate &&
        (await this.familyHasPrivateAccounts(familyGroupId))
      ) {
        return this.restrictedBalanceSheet(asOfDate);
      }
      return this.balanceSheetFromSnapshot(snapshot);
    }

    const anySnapshot = await this.prisma.netWorthSnapshot.findFirst({
      where: { familyGroupId },
    });
    if (anySnapshot) {
      // The family has real snapshot history — this specific `asOfDate`
      // just predates all of it. Honest "no data", not an invented zero.
      return {
        asOfDate: asOfDate.toISOString(),
        totalAssets: 0,
        totalLiabilities: 0,
        netWorth: 0,
        assets: [],
        liabilities: [],
        dataAvailable: false,
        isHistorical: false,
        restrictedForViewer: false,
      };
    }

    return this.computeLiveBalanceSheet(familyGroupId, asOfDate, canSeePrivate);
  }

  /**
   * EPIC-023 Task B retry (CRITICAL 2) — whether ANY account in this family
   * is flagged `isPrivate`. Only ever queried when `canSeePrivate` is false
   * (an owner/admin_staff/spouse viewer never needs this check); a `true`
   * result means a privacy-open `NetWorthSnapshot` cannot be shown to this
   * viewer as-is.
   *
   * ACCOUNTS ONLY — deliberately narrower than `familyHasPrivateItems`
   * below. `getBalanceSheet` is the only caller: a private-CATEGORY
   * transaction still moves a VISIBLE account's balance, so the balance
   * sheet discloses nothing a member cannot already see from that
   * account's own total, and does not need the category check.
   */
  private async familyHasPrivateAccounts(
    familyGroupId: string,
  ): Promise<boolean> {
    const row = await this.prisma.account.findFirst({
      where: { familyGroupId, isPrivate: true },
      select: { id: true },
    });
    return row !== null;
  }

  /**
   * EPIC-023 Task B3 review (HIGH, FIX 2) — whether the family has any
   * private `Account` OR any private `Category`. Only `getReconciliationBridge`
   * calls this (not `getBalanceSheet` — see `familyHasPrivateAccounts`'s doc
   * comment for why the narrower, accounts-only check is correct there).
   *
   * The bridge needs the wider check because it mixes a privacy-OPEN
   * source (`NetWorthSnapshot.netWorth`, captured with
   * `computeNetWorthBreakdown(..., true)`) with a privacy-FILTERED one
   * (`transactionPrivacyWhere`, which excludes both a private account's
   * AND a private category's transactions). A family with zero private
   * accounts but at least one private category used to slip past the
   * accounts-only guard entirely: `opening`/`closing` came from the
   * privacy-open snapshot while `profit`/`contribution` silently excluded
   * the private-category transactions, and the hidden amount landed
   * verbatim in `unexplained` — rendered in warning colour, with
   * `restrictedForViewer: false`, effectively an oracle a `member` could
   * walk day-by-day (via the unclamped `startDate`/`endDate` query params)
   * to recover a private transaction's exact amount.
   */
  private async familyHasPrivateItems(familyGroupId: string): Promise<boolean> {
    const [privateAccount, privateCategory] = await Promise.all([
      this.prisma.account.findFirst({
        where: { familyGroupId, isPrivate: true },
        select: { id: true },
      }),
      this.prisma.category.findFirst({
        where: { familyGroupId, isPrivate: true },
        select: { id: true },
      }),
    ]);
    return privateAccount !== null || privateCategory !== null;
  }

  /** Honest "not for this viewer" balance sheet — see `familyHasPrivateAccounts`. */
  private restrictedBalanceSheet(asOfDate: Date): BalanceSheetDto {
    return {
      asOfDate: asOfDate.toISOString(),
      totalAssets: 0,
      totalLiabilities: 0,
      netWorth: 0,
      assets: [],
      liabilities: [],
      dataAvailable: false,
      isHistorical: false,
      restrictedForViewer: true,
    };
  }

  /** Builds a `BalanceSheetDto` from a family-wide `NetWorthSnapshot` row —
   * bucket totals only, no itemization (the snapshot has none to give). */
  private balanceSheetFromSnapshot(snapshot: {
    date: Date;
    totalCash: bigint;
    totalInvestments: bigint;
    totalAssets: bigint;
    totalLiabilities: bigint;
    netWorth: bigint;
  }): BalanceSheetDto {
    const totalCash = Number(snapshot.totalCash);
    const totalInvestments = Number(snapshot.totalInvestments);
    const physicalAssets = Number(snapshot.totalAssets);
    const totalLiabilities = Number(snapshot.totalLiabilities);

    const assets: BalanceSheetDto["assets"] = [];
    if (totalCash > 0) {
      assets.push({
        category: "Kas & Setara Kas",
        amount: totalCash,
        items: [],
      });
    }
    if (totalInvestments > 0) {
      assets.push({
        category: "Investasi",
        amount: totalInvestments,
        items: [],
      });
    }
    if (physicalAssets > 0) {
      assets.push({
        category: "Aset Lainnya",
        amount: physicalAssets,
        items: [],
      });
    }

    const liabilities: BalanceSheetDto["liabilities"] = [];
    if (totalLiabilities > 0) {
      liabilities.push({
        category: "Liabilitas",
        amount: totalLiabilities,
        items: [],
      });
    }

    return {
      // The snapshot's own date — see the `asOfDate` doc comment on
      // BalanceSheetDto for why this must not be the requested date.
      asOfDate: snapshot.date.toISOString(),
      totalAssets: totalCash + totalInvestments + physicalAssets,
      totalLiabilities,
      netWorth: Number(snapshot.netWorth),
      assets,
      liabilities,
      dataAvailable: true,
      isHistorical: true,
      restrictedForViewer: false,
    };
  }

  /** The previous (pre-EPIC-023-B2) live, privacy-scoped computation — kept
   * as the fallback for a family with no snapshot history at all yet. */
  private async computeLiveBalanceSheet(
    familyGroupId: string,
    asOfDate: Date,
    canSeePrivate: boolean,
  ): Promise<BalanceSheetDto> {
    const [accounts, assetsList, liabilitiesList, investmentsList] =
      await Promise.all([
        this.prisma.account.findMany({
          where: {
            familyGroupId,
            ...accountPrivacyWhere(canSeePrivate),
            includeInNetWorth: true,
          },
          select: { name: true, type: true, balance: true },
        }),
        this.prisma.asset.findMany({
          where: { familyGroupId },
          select: { name: true, type: true, currentValue: true },
        }),
        this.prisma.liability.findMany({
          where: { familyGroupId },
          select: { name: true, type: true, remainingBalance: true },
        }),
        // EPIC-022 (adversarial review round 3, finding 1, CRITICAL) —
        // investments were never queried here at all, so any family holding
        // investments had its balance sheet under-report totalAssets/
        // netWorth by the entire portfolio while /ringkasan and /beranda
        // (dashboard.service.ts's computeNetWorthBreakdown) reported
        // correctly — and the ✅ "Seimbang" banner printed over the
        // discrepancy. No `isPrivate` field exists on Investment (matches
        // computeNetWorthBreakdown, which also applies no privacy filter
        // here), so nothing to scope. Same read-only, no-live-refresh price
        // basis as the dashboard — see investment-value.util.ts.
        this.prisma.investment.findMany({
          where: { familyGroupId },
          select: {
            name: true,
            ticker: true,
            type: true,
            quantity: true,
            costBasisPerUnit: true,
            interestRatePct: true,
            purchasedAt: true,
            maturityDate: true,
            prices: { orderBy: { recordedAt: "desc" }, take: 1 },
            familyGroup: { select: { goldPricePerGram: true } },
          },
        }),
      ]);

    // Group account balances into "Kas & Setara Kas"
    const cashTotal = accounts.reduce((s, a) => s + Number(a.balance), 0);

    const assetsGrouped = new Map<
      string,
      { amount: number; items: { name: string; amount: number }[] }
    >();

    // Cash bucket from accounts
    assetsGrouped.set("Kas & Setara Kas", {
      amount: cashTotal,
      items: accounts.map((a) => ({
        name: a.name,
        amount: Number(a.balance),
      })),
    });

    // Investment portfolio bucket — valued on the same basis as the rest of
    // the app (investmentPositionValue: latest recorded price × quantity,
    // falling back to cost basis), rounded to the nearest rupiah to match
    // every other (BigInt-backed) balance-sheet figure.
    if (investmentsList.length > 0) {
      const investmentItems = investmentsList.map((inv) => ({
        name: `${inv.ticker} — ${inv.name}`,
        amount: Math.round(investmentPositionValue(inv).toNumber()),
      }));
      assetsGrouped.set("Investasi", {
        amount: investmentItems.reduce((s, i) => s + i.amount, 0),
        items: investmentItems,
      });
    }

    // Physical assets grouped by type
    for (const asset of assetsList) {
      const existing = assetsGrouped.get(asset.type) ?? {
        amount: 0,
        items: [],
      };
      const amount = Number(asset.currentValue);
      assetsGrouped.set(asset.type, {
        amount: existing.amount + amount,
        items: [...existing.items, { name: asset.name, amount }],
      });
    }

    const assets = Array.from(assetsGrouped.entries()).map(
      ([category, { amount, items }]) => ({ category, amount, items }),
    );
    const totalAssets = assets.reduce((s, a) => s + a.amount, 0);

    // Liabilities grouped by type
    const liabilitiesGrouped = new Map<
      string,
      { amount: number; items: { name: string; amount: number }[] }
    >();
    for (const lib of liabilitiesList) {
      const existing = liabilitiesGrouped.get(lib.type) ?? {
        amount: 0,
        items: [],
      };
      const amount = Number(lib.remainingBalance);
      liabilitiesGrouped.set(lib.type, {
        amount: existing.amount + amount,
        items: [...existing.items, { name: lib.name, amount }],
      });
    }

    const liabilities = Array.from(liabilitiesGrouped.entries()).map(
      ([category, { amount, items }]) => ({ category, amount, items }),
    );
    const totalLiabilities = liabilities.reduce((s, l) => s + l.amount, 0);

    return {
      asOfDate: asOfDate.toISOString(),
      totalAssets,
      totalLiabilities,
      netWorth: totalAssets - totalLiabilities,
      assets,
      liabilities,
      dataAvailable: true,
      isHistorical: false,
      restrictedForViewer: false,
    };
  }

  async getCashflowStatement(
    familyGroupId: string,
    startDate: Date,
    endDate: Date,
    canSeePrivate: boolean,
  ): Promise<CashflowStatementDto> {
    const [txs, accounts] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          familyGroupId,
          occurredAt: { gte: startDate, lte: endDate },
          ...transactionPrivacyWhere(canSeePrivate),
        },
        select: {
          amount: true,
          type: true,
          category: { select: { coaAccount: { select: { direction: true } } } },
        },
      }),
      this.prisma.account.findMany({
        where: { familyGroupId, ...accountPrivacyWhere(canSeePrivate) },
        select: { balance: true },
      }),
    ]);

    let operatingInflows = 0;
    let operatingOutflows = 0;

    // COA-driven (EPIC-017): TRANSFER-direction flows (wealth allocation) are
    // excluded from operating cashflow, matching P&L classification.
    for (const tx of txs) {
      const amount = Number(tx.amount);
      const dir = txCoaDirection(tx);
      if (dir === CoaDirection.INCOME) operatingInflows += amount;
      else if (dir === CoaDirection.EXPENSE) operatingOutflows += amount;
    }

    const netOperating = operatingInflows - operatingOutflows;

    // Investing: placeholder until investment transactions are tracked
    const investingInflows = 0;
    const investingOutflows = 0;
    const netInvesting = 0;

    const closingBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
    const openingBalance = closingBalance - netOperating - netInvesting;

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      operatingInflows,
      operatingOutflows,
      netOperating,
      investingInflows,
      investingOutflows,
      netInvesting,
      openingBalance,
      closingBalance,
      netChange: netOperating + netInvesting,
    };
  }

  async getSankey(
    familyGroupId: string,
    startDate: Date,
    endDate: Date,
    canSeePrivate: boolean,
  ): Promise<SankeyDto> {
    // No tx.type filter: classification is COA-driven (EPIC-017), so include all
    // transactions and keep only INCOME/EXPENSE COA directions below.
    const txs = await this.prisma.transaction.findMany({
      where: {
        familyGroupId,
        occurredAt: { gte: startDate, lte: endDate },
        ...transactionPrivacyWhere(canSeePrivate),
      },
      select: {
        amount: true,
        type: true,
        category: {
          select: {
            id: true,
            name: true,
            coaAccount: { select: { direction: true } },
          },
        },
      },
    });

    const incomeNodes = new Map<string, { label: string; amount: number }>();
    const expenseNodes = new Map<string, { label: string; amount: number }>();
    const links: { source: string; target: string; value: number }[] = [];

    for (const tx of txs) {
      const amount = Number(tx.amount);
      const catId = tx.category?.id ?? "uncategorized";
      const catLabel = tx.category?.name ?? "Lainnya";
      const dir = txCoaDirection(tx);

      if (dir === CoaDirection.INCOME) {
        const existing = incomeNodes.get(catId) ?? {
          label: catLabel,
          amount: 0,
        };
        incomeNodes.set(catId, {
          label: catLabel,
          amount: existing.amount + amount,
        });
      } else if (dir === CoaDirection.EXPENSE) {
        const existing = expenseNodes.get(catId) ?? {
          label: catLabel,
          amount: 0,
        };
        expenseNodes.set(catId, {
          label: catLabel,
          amount: existing.amount + amount,
        });
      }
    }

    // Build nodes array
    const sankeyNodes = [
      ...Array.from(incomeNodes.entries()).map(([id, { label }]) => ({
        id,
        label,
      })),
      ...Array.from(expenseNodes.entries()).map(([id, { label }]) => ({
        id,
        label,
      })),
    ];

    // Links: each income category → each expense category proportionally
    // Simplified: one "total income" to each expense node
    const totalIncome = Array.from(incomeNodes.values()).reduce(
      (s, n) => s + n.amount,
      0,
    );

    for (const [incId, incData] of incomeNodes.entries()) {
      for (const [expId, expData] of expenseNodes.entries()) {
        const value =
          totalIncome > 0
            ? Math.round((incData.amount / totalIncome) * expData.amount)
            : 0;
        if (value > 0) {
          links.push({ source: incId, target: expId, value });
        }
      }
    }

    return { nodes: sankeyNodes, links };
  }

  /**
   * EPIC-023 B3 (D24, US-RPT-11; rewrite, attempt 3) — reconciles the gap
   * between P&L profit and the actual net-worth change over the same
   * period, so a family can see WHY their profit and their wealth change
   * disagree instead of only a "✅ Seimbang" banner that says nothing about
   * the difference.
   *
   *   - `opening`/`closing` come straight from the two `NetWorthSnapshot`
   *     rows' own `netWorth` column. `opening` anchors to the last
   *     snapshot ON OR BEFORE `startDate` itself (EPIC-023 Task B3 review,
   *     HIGH) — the previous anchor (`startDate + 24h - 1ms`) selected the
   *     snapshot captured ON the period's first day, which (captured
   *     daily at 02:00 UTC = 09:00 WIB — net-worth-snapshot.scheduler.ts)
   *     already includes the first ~9 hours of that day's activity while
   *     the transaction window starts at 00:00 WIB the same day — opening
   *     and profit overlapped. `lte: startDate` is the standard "prior
   *     close is this period's opening" anchor, symmetric with
   *     `closing`'s own `lte: endDate`.
   *
   *     KNOWN, NAMED LIMITATION — not fixed here: snapshots record
   *     balances at CAPTURE time, but profit is computed from
   *     `occurredAt`. A back-dated entry (recorded 20 Aug, `occurredAt` 5
   *     Jul) moves the balance in one snapshot period and the profit in
   *     another; these can never fully reconcile against daily snapshots.
   *     That residual correctly lands in `unexplained` — which is exactly
   *     what the field is for. Fixing it would mean changing snapshot
   *     capture semantics (B2 / the balance sheet), a product-owner
   *     decision, not a bug in this method.
   *   - `profit` comes from the period's transactions, COA-direction
   *     classified exactly like `getPnl` (TRANSFER — wealth allocation and
   *     debt principal, per EPIC-023 A1 — is excluded from profit).
   *   - `contribution` is the SIGNED sum of the period's group-3 ("Wealth
   *     Allocation") TRANSFER transactions. A `Transaction` has no FK to
   *     the `Asset`/`Investment` row it funds, so attempt 2 guessed an
   *     asset-vs-investment split from a hardcoded COA `code` — which
   *     misfiled every group-3 code except one — and ignored direction
   *     entirely, so a withdrawal back to cash was ADDED to contributions
   *     instead of subtracted (see `wealthAllocationCashEffect`'s doc
   *     comment). This rewrite reports ONE combined figure instead, signed
   *     by the transaction's real cash effect. It is now a real
   *     SUBTRAHEND in the identity below, not a derived-away memo line.
   *   - `holdingsChange` is the RAW combined snapshot delta — (Δ
   *     totalAssets + Δ totalInvestments), nothing subtracted (EPIC-023
   *     Task B3 review, HIGH — replaces the old derived `revaluation`
   *     field). Deriving `revaluation` as `rawDelta - contribution` looked
   *     like it isolated "market movement only", but nothing links a
   *     `Transaction` to the `Asset`/`Investment` row it funds: when a
   *     group-3 outflow was recorded WITHOUT its matching holding update
   *     (or vice versa), that subtraction silently absorbed the mismatch
   *     into a FABRICATED gain or loss — a 10,000,000 contribution with a
   *     flat snapshot produced `revaluation: -10,000,000`, a market loss
   *     that never happened, while `unexplained` stayed exactly 0 and hid
   *     it. `holdingsChange` is directly measured instead — nothing about
   *     it depends on `contribution` being right.
   *   - `unexplained` is `closing − (opening + profit − contribution +
   *     holdingsChange)` — an HONEST named residual, not forced to zero.
   *     COA group 4 (Receivable) has no counterpart in
   *     `computeNetWorthBreakdown` (no receivable table backs it), so
   *     lending money to a friend lowers cash with nothing offsetting it —
   *     the identity genuinely does not hold that month, and naming the
   *     gap is more honest than hiding it inside another term.
   *
   * Full identity: `opening + profit − contribution + holdingsChange +
   * unexplained = closing`. (D24 itself says "opening + (income −
   * expenses) + change in asset & investment values = closing" — that
   * formula omits the contribution outflow; this is D24 with that term
   * restored, not a departure from it.)
   */
  async getReconciliationBridge(
    familyGroupId: string,
    startDate: Date,
    endDate: Date,
    canSeePrivate: boolean,
  ): Promise<ReconciliationBridgeDto> {
    const [openingSnapshot, closingSnapshot, transactions, isRestricted] =
      await Promise.all([
        // EPIC-023 Task B3 review (HIGH) — `lte: startDate`, NOT a
        // same-day-inclusive anchor; see this method's doc comment for why
        // the previous `startDate + 24h - 1ms` anchor double-counted the
        // period's first ~9 hours.
        this.prisma.netWorthSnapshot.findFirst({
          where: { familyGroupId, date: { lte: startDate } },
          orderBy: { date: "desc" },
        }),
        this.prisma.netWorthSnapshot.findFirst({
          where: { familyGroupId, date: { lte: endDate } },
          orderBy: { date: "desc" },
        }),
        this.prisma.transaction.findMany({
          where: {
            familyGroupId,
            occurredAt: { gte: startDate, lte: endDate },
            ...transactionPrivacyWhere(canSeePrivate),
          },
          select: {
            amount: true,
            type: true,
            toAccountId: true,
            category: {
              select: {
                coaAccount: {
                  select: { direction: true, groupNum: true },
                },
              },
            },
          },
        }),
        // EPIC-023 Task B3 review (HIGH, FIX 2) — only worth checking when
        // this viewer may not see private items; an owner/admin_staff/
        // spouse viewer never needs the restriction. Uses
        // `familyHasPrivateItems` (accounts OR categories), NOT
        // `familyHasPrivateAccounts` — see that method's doc comment for
        // why this endpoint needs the wider check and `getBalanceSheet`
        // does not.
        canSeePrivate
          ? Promise.resolve(false)
          : this.familyHasPrivateItems(familyGroupId),
      ]);

    if (!openingSnapshot || !closingSnapshot) {
      return this.emptyReconciliationBridge(startDate, endDate, false);
    }

    // `opening`/`closing` come straight from the snapshots' own (privacy-
    // open) `netWorth` column — a viewer who may not see private items
    // cannot be shown either figure once the family holds a private
    // account, exactly like `getBalanceSheet`'s snapshot branch.
    if (isRestricted) {
      return this.emptyReconciliationBridge(startDate, endDate, true);
    }

    let revenue = 0;
    let expenses = 0;
    let contribution = 0;
    for (const tx of transactions) {
      const amount = Number(tx.amount);
      const dir = txCoaDirection(tx);
      if (dir === CoaDirection.INCOME) {
        revenue += amount;
      } else if (dir === CoaDirection.EXPENSE) {
        expenses += amount;
      } else if (
        dir === CoaDirection.TRANSFER &&
        tx.category?.coaAccount.groupNum === WEALTH_ALLOCATION_GROUP_NUM
      ) {
        contribution += wealthAllocationCashEffect(tx, amount);
      }
    }

    // RAW combined snapshot delta — nothing subtracted. See this method's
    // doc comment (EPIC-023 Task B3 review, HIGH) for why the old derived
    // `revaluation = rawDelta - contribution` fabricated a gain/loss
    // whenever a contribution and its holding update did not both land in
    // the snapshot's window.
    const holdingsChange =
      Number(closingSnapshot.totalAssets) -
      Number(openingSnapshot.totalAssets) +
      Number(closingSnapshot.totalInvestments) -
      Number(openingSnapshot.totalInvestments);
    const profit = revenue - expenses;
    const opening = Number(openingSnapshot.netWorth);
    const closing = Number(closingSnapshot.netWorth);

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      opening,
      closing,
      profit,
      contribution,
      holdingsChange,
      // Honest named residual, not forced to zero — see this method's doc
      // comment for why the identity genuinely does not always hold (e.g. a
      // COA group-4 Receivable movement, or a back-dated entry crossing a
      // snapshot boundary).
      unexplained: closing - (opening + profit - contribution + holdingsChange),
      dataAvailable: true,
      restrictedForViewer: false,
    };
  }

  /**
   * EPIC-024 Task M (M1, D16, US-RPT-14) — yearly tanggal x bulan matrix for
   * ONE COA account, joining `Transaction` → `Category.coaAccountId`
   * (Category.coaAccountId is NOT NULL, per the epic's Evidence note, so
   * every categorized transaction is reachable this way; a category-LESS
   * transaction has no COA account at all and is correctly excluded).
   *
   * `cells` is built ONLY from the transactions actually returned — a real
   * `Transaction.occurredAt` can never carry an invalid calendar date (e.g.
   * 31 April), so a short month never gets a fabricated day-31 entry, and a
   * year with zero matching transactions naturally yields `cells: {}`
   * rather than a synthetic populated grid.
   */
  async getCoaMatrix(
    familyGroupId: string,
    coaAccountId: string,
    year: number,
    canSeePrivate: boolean,
  ): Promise<CoaMatrixDto> {
    const startDate = new Date(year, 0, 1, 0, 0, 0, 0);
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        familyGroupId,
        occurredAt: { gte: startDate, lte: endDate },
        category: { coaAccountId },
        ...transactionPrivacyWhere(canSeePrivate),
      },
      select: {
        id: true,
        amount: true,
        description: true,
        occurredAt: true,
      },
      orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
    });

    const cells: CoaMatrixDto["cells"] = {};
    let total = 0;

    for (const tx of transactions) {
      const month = tx.occurredAt.getMonth() + 1;
      const day = tx.occurredAt.getDate();
      const amount = Number(tx.amount);
      total += amount;

      const monthCells = cells[month] ?? {};
      const dayCells = monthCells[day] ?? [];
      cells[month] = {
        ...monthCells,
        [day]: [
          ...dayCells,
          { txId: tx.id, amount, description: tx.description ?? null },
        ],
      };
    }

    return { coaAccountId, year, total, cells };
  }

  /** Zeroed-out `ReconciliationBridgeDto` — either genuinely no snapshot
   * history yet (`restrictedForViewer: false`), or a snapshot exists but
   * cannot be shown to this viewer (`restrictedForViewer: true`) — see
   * `getReconciliationBridge`'s doc comment. */
  private emptyReconciliationBridge(
    startDate: Date,
    endDate: Date,
    restrictedForViewer: boolean,
  ): ReconciliationBridgeDto {
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      opening: 0,
      closing: 0,
      profit: 0,
      contribution: 0,
      holdingsChange: 0,
      unexplained: 0,
      dataAvailable: false,
      restrictedForViewer,
    };
  }
}
