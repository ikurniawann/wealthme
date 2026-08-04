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
  DetailReportDto,
  PeriodPoint,
  PnlDto,
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
  ): Promise<ReportSummaryDto> {
    const now = anchor;
    const startDate = new Date(
      now.getFullYear(),
      now.getMonth() - (months - 1),
      1,
    );
    startDate.setHours(0, 0, 0, 0);
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
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
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
        accountName: tx.account.name,
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
   * EPIC-022 (adversarial review round 3, finding 3) — `asOfDate` is
   * accepted but there is no historical-balance data model for accounts,
   * assets, liabilities, or investments (only a daily aggregate
   * `NetWorthSnapshot`, not an itemized one) — every query below reads
   * CURRENT balances, same as the rest of the app. The UI discloses this
   * (matching the B3 Saldo Awal/Akhir precedent) rather than silently
   * implying a true point-in-time statement; do not add a date filter here
   * without also adding real historical balance tracking.
   */
  async getBalanceSheet(
    familyGroupId: string,
    asOfDate: Date,
    canSeePrivate: boolean,
  ): Promise<BalanceSheetDto> {
    const [accounts, assetsList, liabilitiesList, investmentsList] =
      await Promise.all([
        this.prisma.account.findMany({
          where: { familyGroupId, ...accountPrivacyWhere(canSeePrivate) },
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
            quantity: true,
            costBasisPerUnit: true,
            prices: { orderBy: { recordedAt: "desc" }, take: 1 },
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
}
