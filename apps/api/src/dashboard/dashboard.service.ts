import { Injectable } from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type {
  AccountSummaryItemDto,
  AllocationItemDto,
  CashflowDto,
  DashboardSummaryDto,
} from "@wealthme/contracts";

type MonthKey = string; // 'YYYY-MM'

const ACCOUNT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  bank: { label: "Rekening", color: "#06B6D4" },
  ewallet: { label: "Dana", color: "#10B981" },
  investment: { label: "Investasi", color: "#4F46E5" },
  property: { label: "Aset Fisik", color: "#F59E0B" },
  cash: { label: "Tunai", color: "#6B7280" },
};

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

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(familyGroupId: string): Promise<DashboardSummaryDto> {
    const now = new Date();

    // Accounts
    const accounts = await this.prisma.account.findMany({
      where: { familyGroupId },
      select: { balance: true, type: true, name: true },
    });
    const netWorth = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

    // Account summary by type
    const byType = new Map<string, number>();
    for (const a of accounts) {
      byType.set(a.type, (byType.get(a.type) ?? 0) + Number(a.balance));
    }
    const accountSummary: AccountSummaryItemDto[] = Array.from(
      byType.entries(),
    ).map(([type, total]) => ({
      type,
      label: ACCOUNT_TYPE_CONFIG[type]?.label ?? type,
      total,
    }));

    // Allocation (by type, percentage)
    const totalBalance = netWorth === 0 ? 1 : netWorth;
    const allocation: AllocationItemDto[] = accountSummary
      .filter((s) => s.total > 0)
      .map((s) => ({
        label: s.label,
        value: Math.round((s.total / totalBalance) * 100),
        amount: s.total,
        color: ACCOUNT_TYPE_CONFIG[s.type]?.color ?? "#6B7280",
      }));

    // Date ranges
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Transactions
    const transactions = await this.prisma.transaction.findMany({
      where: { familyGroupId, occurredAt: { gte: sixMonthsAgo } },
      select: {
        id: true,
        amount: true,
        type: true,
        description: true,
        occurredAt: true,
        category: { select: { name: true } },
        account: { select: { name: true } },
      },
      orderBy: { occurredAt: "desc" },
    });

    // Cashflow: last 6 calendar months
    const monthKeys: MonthKey[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      );
    }
    const incomeByMonth = new Map<MonthKey, number>(
      monthKeys.map((k) => [k, 0]),
    );
    const expenseByMonth = new Map<MonthKey, number>(
      monthKeys.map((k) => [k, 0]),
    );

    for (const tx of transactions) {
      const key = `${tx.occurredAt.getFullYear()}-${String(tx.occurredAt.getMonth() + 1).padStart(2, "0")}`;
      if (!incomeByMonth.has(key)) continue;
      if (tx.type === "income") {
        incomeByMonth.set(
          key,
          (incomeByMonth.get(key) ?? 0) + Number(tx.amount),
        );
      } else if (tx.type === "expense") {
        expenseByMonth.set(
          key,
          (expenseByMonth.get(key) ?? 0) + Number(tx.amount),
        );
      }
    }
    const incomeArr = monthKeys.map((k) => incomeByMonth.get(k) ?? 0);
    const expenseArr = monthKeys.map((k) => expenseByMonth.get(k) ?? 0);
    const cashflow: CashflowDto = {
      months: monthKeys.map((k) => {
        const [, m] = k.split("-");
        return MONTH_LABELS[parseInt(m ?? "1", 10) - 1] ?? "";
      }),
      income: incomeArr,
      expense: expenseArr,
      max: Math.max(...incomeArr, ...expenseArr, 1),
    };

    // Sparkline: last 30 days net per day, normalized to 0-100
    const sparkline: number[] = Array(30).fill(0) as number[];
    for (const tx of transactions) {
      if (tx.occurredAt < thirtyDaysAgo) continue;
      const dayIndex = Math.floor(
        (tx.occurredAt.getTime() - thirtyDaysAgo.getTime()) / 86400000,
      );
      if (dayIndex < 0 || dayIndex >= 30) continue;
      const delta =
        tx.type === "income"
          ? Number(tx.amount)
          : tx.type === "expense"
            ? -Number(tx.amount)
            : 0;
      sparkline[dayIndex] = (sparkline[dayIndex] ?? 0) + delta;
    }
    const sparkMax = Math.max(...sparkline.map(Math.abs), 1);
    const sparkNormalized = sparkline.map((v) =>
      Math.round(((v + sparkMax) / (2 * sparkMax)) * 100),
    );

    // Current month stats
    const currentMonthTx = transactions.filter(
      (tx) => tx.occurredAt >= currentMonthStart,
    );
    const monthIncome = currentMonthTx
      .filter((tx) => tx.type === "income")
      .reduce((s, tx) => s + Number(tx.amount), 0);
    const monthExpense = currentMonthTx
      .filter((tx) => tx.type === "expense")
      .reduce((s, tx) => s + Number(tx.amount), 0);
    const savingsRate =
      monthIncome > 0
        ? Math.round(((monthIncome - monthExpense) / monthIncome) * 100)
        : 0;

    // Recent transactions (last 5)
    const recentTransactions = transactions.slice(0, 5).map((tx) => ({
      id: tx.id,
      description: tx.description ?? null,
      amount: Number(tx.amount),
      type: tx.type as "income" | "expense" | "transfer",
      categoryName: tx.category?.name ?? null,
      accountName: tx.account.name,
      occurredAt: tx.occurredAt.toISOString(),
    }));

    return {
      netWorth,
      cashflow,
      sparkline: sparkNormalized,
      allocation,
      accountSummary,
      currentMonth: {
        income: monthIncome,
        expense: monthExpense,
        net: monthIncome - monthExpense,
        savingsRate,
      },
      recentTransactions,
    };
  }
}
