import { Injectable } from "@nestjs/common";

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
  ): Promise<ReportSummaryDto> {
    const now = new Date();
    const startDate = new Date(
      now.getFullYear(),
      now.getMonth() - (months - 1),
      1,
    );
    startDate.setHours(0, 0, 0, 0);

    const transactions = await this.prisma.transaction.findMany({
      where: { familyGroupId, occurredAt: { gte: startDate } },
      select: {
        amount: true,
        type: true,
        occurredAt: true,
        category: { select: { name: true, color: true } },
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

      if (tx.type === "income") {
        incomeByMonth.set(key, (incomeByMonth.get(key) ?? 0) + amount);
        const existing = incomeByCat.get(catName) ?? {
          amount: 0,
          color: catColor,
        };
        incomeByCat.set(catName, {
          amount: existing.amount + amount,
          color: catColor,
        });
      } else if (tx.type === "expense") {
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
  ): Promise<BankReportDto> {
    const accounts = await this.prisma.account.findMany({
      where: { familyGroupId },
      select: {
        id: true,
        name: true,
        institution: true,
        balance: true,
        transactions: {
          where: { occurredAt: { gte: startDate, lte: endDate } },
          select: { amount: true, type: true },
        },
      },
    });

    let totalIncome = 0;
    let totalExpense = 0;

    const banks = accounts.map((acc) => {
      const income = acc.transactions
        .filter((t) => t.type === "income")
        .reduce((s, t) => s + Number(t.amount), 0);
      const expense = acc.transactions
        .filter((t) => t.type === "expense")
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
  ): Promise<DetailReportDto> {
    const txs = await this.prisma.transaction.findMany({
      where: {
        familyGroupId,
        occurredAt: { gte: startDate, lte: endDate },
      },
      select: {
        id: true,
        occurredAt: true,
        description: true,
        type: true,
        amount: true,
        category: { select: { name: true } },
        account: { select: { name: true } },
      },
      orderBy: { occurredAt: "desc" },
    });

    let totalIncome = 0;
    let totalExpense = 0;

    const transactions = txs.map((tx) => {
      const amount = Number(tx.amount);
      if (tx.type === "income") totalIncome += amount;
      else if (tx.type === "expense") totalExpense += amount;

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
  ): Promise<PnlDto> {
    const durationMs = endDate.getTime() - startDate.getTime();
    const prevEnd = new Date(startDate.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - durationMs);

    const [currentTxs, prevTxs] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          familyGroupId,
          occurredAt: { gte: startDate, lte: endDate },
        },
        select: {
          amount: true,
          type: true,
          category: { select: { name: true, color: true } },
        },
      }),
      this.prisma.transaction.findMany({
        where: {
          familyGroupId,
          occurredAt: { gte: prevStart, lte: prevEnd },
        },
        select: { amount: true, type: true },
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

      if (tx.type === "income") {
        revenue += amount;
        const existing = revenueByCategory.get(catName) ?? {
          amount: 0,
          color: catColor,
        };
        revenueByCategory.set(catName, {
          amount: existing.amount + amount,
          color: catColor,
        });
      } else if (tx.type === "expense") {
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
      if (tx.type === "income") previousRevenue += amount;
      else if (tx.type === "expense") previousExpenses += amount;
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

  async getBalanceSheet(
    familyGroupId: string,
    asOfDate: Date,
  ): Promise<BalanceSheetDto> {
    const [accounts, assetsList, liabilitiesList] = await Promise.all([
      this.prisma.account.findMany({
        where: { familyGroupId },
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
  ): Promise<CashflowStatementDto> {
    const [txs, accounts] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          familyGroupId,
          occurredAt: { gte: startDate, lte: endDate },
        },
        select: { amount: true, type: true },
      }),
      this.prisma.account.findMany({
        where: { familyGroupId },
        select: { balance: true },
      }),
    ]);

    let operatingInflows = 0;
    let operatingOutflows = 0;

    for (const tx of txs) {
      const amount = Number(tx.amount);
      if (tx.type === "income") operatingInflows += amount;
      else if (tx.type === "expense") operatingOutflows += amount;
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
  ): Promise<SankeyDto> {
    const txs = await this.prisma.transaction.findMany({
      where: {
        familyGroupId,
        occurredAt: { gte: startDate, lte: endDate },
        type: { in: ["income", "expense"] },
      },
      select: {
        amount: true,
        type: true,
        category: { select: { id: true, name: true } },
      },
    });

    const incomeNodes = new Map<string, { label: string; amount: number }>();
    const expenseNodes = new Map<string, { label: string; amount: number }>();
    const links: { source: string; target: string; value: number }[] = [];

    for (const tx of txs) {
      const amount = Number(tx.amount);
      const catId = tx.category?.id ?? "uncategorized";
      const catLabel = tx.category?.name ?? "Lainnya";

      if (tx.type === "income") {
        const existing = incomeNodes.get(catId) ?? {
          label: catLabel,
          amount: 0,
        };
        incomeNodes.set(catId, {
          label: catLabel,
          amount: existing.amount + amount,
        });
      } else if (tx.type === "expense") {
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
