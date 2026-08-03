import { Injectable } from "@nestjs/common";
import { CoaDirection } from "@prisma/client";

import { txCoaDirection } from "../common/utils/coa-classify.util";
import {
  accountPrivacyWhere,
  transactionPrivacyWhere,
} from "../common/utils/privacy.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type {
  AccountSummaryItemDto,
  AllocationItemDto,
  CashflowDto,
  DashboardSummaryDto,
  NetWorthDto,
  NetWorthHistoryDto,
  NetWorthHistoryPointDto,
} from "@wealthme/contracts";

interface NetWorthBreakdown {
  totalCash: bigint;
  totalInvestments: bigint;
  totalAssets: bigint;
  totalLiabilities: bigint;
  netWorth: bigint;
}

type MonthKey = string;

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

  async getSummary(
    familyGroupId: string,
    canSeePrivate: boolean,
  ): Promise<DashboardSummaryDto> {
    const now = new Date();

    const accounts = await this.prisma.account.findMany({
      where: { familyGroupId, ...accountPrivacyWhere(canSeePrivate) },
      select: { balance: true, type: true, name: true },
    });

    const assetsList = await this.prisma.asset.findMany({
      where: { familyGroupId },
      select: { currentValue: true },
    });
    const assetsTotalBigInt = assetsList.reduce(
      (sum, a) => sum + a.currentValue,
      0n,
    );
    const assetsTotal = Number(assetsTotalBigInt);

    // Full rollup (accounts + investments + assets − liabilities), matching
    // the /net-worth endpoint — not just accounts + assets.
    const netWorthBreakdown = await this.computeNetWorthBreakdown(
      familyGroupId,
      canSeePrivate,
    );
    const netWorth = Number(netWorthBreakdown.netWorth);

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

    const totalBalance = netWorth === 0 ? 1 : netWorth;
    const allocation: AllocationItemDto[] = accountSummary
      .filter((s) => s.total > 0)
      .map((s) => ({
        label: s.label,
        value: Math.round((s.total / totalBalance) * 100),
        amount: s.total,
        color: ACCOUNT_TYPE_CONFIG[s.type]?.color ?? "#6B7280",
      }));

    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        familyGroupId,
        occurredAt: { gte: sixMonthsAgo },
        ...transactionPrivacyWhere(canSeePrivate),
      },
      select: {
        id: true,
        amount: true,
        type: true,
        description: true,
        occurredAt: true,
        category: {
          select: { name: true, coaAccount: { select: { direction: true } } },
        },
        account: { select: { name: true } },
      },
      // occurredAt is date-only, so same-day entries tie — createdAt
      // breaks the tie for the "recent activity" slice below.
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    });

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
      // EPIC-017: classify by COA direction (matches /laporan), not tx.type.
      const dir = txCoaDirection(tx);
      if (dir === CoaDirection.INCOME) {
        incomeByMonth.set(
          key,
          (incomeByMonth.get(key) ?? 0) + Number(tx.amount),
        );
      } else if (dir === CoaDirection.EXPENSE) {
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

    const sparkline: number[] = Array(30).fill(0) as number[];
    for (const tx of transactions) {
      if (tx.occurredAt < thirtyDaysAgo) continue;
      const dayIndex = Math.floor(
        (tx.occurredAt.getTime() - thirtyDaysAgo.getTime()) / 86400000,
      );
      if (dayIndex < 0 || dayIndex >= 30) continue;
      const dir = txCoaDirection(tx);
      const delta =
        dir === CoaDirection.INCOME
          ? Number(tx.amount)
          : dir === CoaDirection.EXPENSE
            ? -Number(tx.amount)
            : 0;
      sparkline[dayIndex] = (sparkline[dayIndex] ?? 0) + delta;
    }
    const sparkMax = Math.max(...sparkline.map(Math.abs), 1);
    const sparkNormalized = sparkline.map((v) =>
      Math.round(((v + sparkMax) / (2 * sparkMax)) * 100),
    );

    const currentMonthTx = transactions.filter(
      (tx) => tx.occurredAt >= currentMonthStart,
    );
    const monthIncome = currentMonthTx
      .filter((tx) => txCoaDirection(tx) === CoaDirection.INCOME)
      .reduce((s, tx) => s + Number(tx.amount), 0);
    const monthExpense = currentMonthTx
      .filter((tx) => txCoaDirection(tx) === CoaDirection.EXPENSE)
      .reduce((s, tx) => s + Number(tx.amount), 0);
    const savingsRate =
      monthIncome > 0
        ? Math.round(((monthIncome - monthExpense) / monthIncome) * 100)
        : 0;

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
      assetsTotal,
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

  private async computeNetWorthBreakdown(
    familyGroupId: string,
    canSeePrivate: boolean,
  ): Promise<NetWorthBreakdown> {
    const accounts = await this.prisma.account.findMany({
      where: { familyGroupId, ...accountPrivacyWhere(canSeePrivate) },
      select: { balance: true },
    });
    const totalCash = accounts.reduce((sum, a) => sum + a.balance, 0n);

    const assets = await this.prisma.asset.findMany({
      where: { familyGroupId },
      select: { currentValue: true },
    });
    const totalAssets = assets.reduce((sum, a) => sum + a.currentValue, 0n);

    // EPIC-QA-sweep #2: value at the latest recorded price (nested `prices`
    // take-1 per investment), falling back to cost basis only when no price
    // row exists yet. Same valuation basis as investments.service, minus its
    // market-data refresh — the dashboard only reads already-stored prices.
    const investments = await this.prisma.investment.findMany({
      where: { familyGroupId },
      select: {
        quantity: true,
        costBasisPerUnit: true,
        prices: { orderBy: { recordedAt: "desc" }, take: 1 },
      },
    });
    const totalInvestments = BigInt(
      Math.round(
        investments.reduce((sum, inv) => {
          const price = inv.prices[0]?.price ?? inv.costBasisPerUnit;
          return sum + inv.quantity.toNumber() * price.toNumber();
        }, 0),
      ),
    );

    const liabilityRecords = await this.prisma.liability.findMany({
      where: { familyGroupId },
      select: { remainingBalance: true },
    });
    const totalLiabilities = liabilityRecords.reduce(
      (sum, l) => sum + l.remainingBalance,
      0n,
    );

    const netWorth =
      totalCash + totalInvestments + totalAssets - totalLiabilities;

    return {
      totalCash,
      totalInvestments,
      totalAssets,
      totalLiabilities,
      netWorth,
    };
  }

  async getNetWorth(
    familyGroupId: string,
    canSeePrivate: boolean,
  ): Promise<NetWorthDto> {
    const b = await this.computeNetWorthBreakdown(familyGroupId, canSeePrivate);
    return {
      accountsTotal: b.totalCash.toString(),
      investmentsTotal: b.totalInvestments.toString(),
      assetsTotal: b.totalAssets.toString(),
      liabilitiesTotal: b.totalLiabilities.toString(),
      netWorth: b.netWorth.toString(),
      currency: "IDR",
    };
  }

  /**
   * Capture one net-worth snapshot for a family group. Idempotent per calendar
   * day via an atomic upsert on the (familyGroupId, date) unique index — this
   * closes the check-then-insert race that could otherwise let two concurrent
   * callers both pass a "does it exist?" read and each insert a duplicate row
   * for the same day. Returns true when a NEW row is written (an existing
   * day's snapshot is left untouched, not overwritten).
   */
  async captureSnapshot(
    familyGroupId: string,
    now: Date = new Date(),
  ): Promise<boolean> {
    // UTC day boundary — must match the migration backfill ("capturedAt"::date,
    // a UTC-based cast) or the unique (familyGroupId, date) key would mislabel
    // snapshots by one day on non-UTC deployments.
    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);

    // Snapshots are family-wide totals with no per-viewer dimension — always
    // compute over the full account set, regardless of privacy flags.
    const b = await this.computeNetWorthBreakdown(familyGroupId, true);
    const snapshot = await this.prisma.netWorthSnapshot.upsert({
      where: { familyGroupId_date: { familyGroupId, date: startOfDay } },
      create: {
        familyGroupId,
        capturedAt: now,
        date: startOfDay,
        totalCash: b.totalCash,
        totalInvestments: b.totalInvestments,
        totalAssets: b.totalAssets,
        totalLiabilities: b.totalLiabilities,
        netWorth: b.netWorth,
      },
      // A snapshot already exists for today — no-op; the upsert only exists
      // to make the check-then-write atomic, not to overwrite today's totals.
      update: {},
    });
    return snapshot.capturedAt.getTime() === now.getTime();
  }

  /** Capture a snapshot for every family group (driven by the daily scheduler). */
  async captureAllSnapshots(now: Date = new Date()): Promise<number> {
    const groups = await this.prisma.familyGroup.findMany({
      select: { id: true },
    });
    let written = 0;
    for (const g of groups) {
      if (await this.captureSnapshot(g.id, now)) written += 1;
    }
    return written;
  }

  async getNetWorthHistory(
    familyGroupId: string,
    range = "30d",
  ): Promise<NetWorthHistoryDto> {
    const since = new Date();
    const monthMatch = /^(\d+)m$/.exec(range);
    const dayMatch = /^(\d+)d$/.exec(range);
    if (monthMatch) {
      since.setMonth(since.getMonth() - parseInt(monthMatch[1] ?? "12", 10));
    } else if (dayMatch) {
      since.setDate(since.getDate() - parseInt(dayMatch[1] ?? "30", 10));
    } else {
      since.setDate(since.getDate() - 30);
    }

    const rows = await this.prisma.netWorthSnapshot.findMany({
      where: { familyGroupId, capturedAt: { gte: since } },
      orderBy: { capturedAt: "asc" },
    });

    const points: NetWorthHistoryPointDto[] = rows.map((r) => ({
      capturedAt: r.capturedAt.toISOString(),
      totalCash: r.totalCash.toString(),
      totalInvestments: r.totalInvestments.toString(),
      totalAssets: r.totalAssets.toString(),
      totalLiabilities: r.totalLiabilities.toString(),
      netWorth: r.netWorth.toString(),
    }));

    return { range, currency: "IDR", points };
  }
}
