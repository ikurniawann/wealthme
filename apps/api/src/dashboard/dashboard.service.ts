import { Injectable } from "@nestjs/common";
import { CoaDirection } from "@prisma/client";

import { COUNTED_ASSET_WHERE } from "../assets/asset-access";
import { txCoaDirection } from "../common/utils/coa-classify.util";
import {
  accountPrivacyWhere,
  restrictedAccountWhere,
  restrictedTransactionWhere,
  transactionPrivacyWhere,
  isRowScoped,
  type ScopeSubject,
} from "../common/utils/privacy.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InsuranceNetWorthService } from "../insurances/value/insurance-net-worth.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InvestmentValuationService } from "../investments/valuation/investment-valuation.service";
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
  /** Asuransi S6 — confirmed policy value of included policies (whole IDR). */
  totalInsurance: bigint;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly investmentValuation: InvestmentValuationService,
    private readonly insuranceNetWorth: InsuranceNetWorthService,
  ) {}

  /**
   * `viewerRole`/`viewerUserId` (EPIC-023 Task C, D5) — a `dependant`/
   * `operational` viewer only ever sees their OWN account's cash and their
   * own transactions here; Asset/Investment/Liability totals collapse to 0
   * for them (CASL grants neither role "read" on those subjects — see
   * casl-ability.factory.ts — so this dashboard must not compose a total
   * from data they cannot otherwise see).
   */
  async getSummary(
    familyGroupId: string,
    canSeePrivate: boolean,
    viewerRole: ScopeSubject = null,
    viewerUserId?: string,
  ): Promise<DashboardSummaryDto> {
    const now = new Date();

    const accounts = await this.prisma.account.findMany({
      where: {
        familyGroupId,
        ...accountPrivacyWhere(canSeePrivate),
        ...restrictedAccountWhere(viewerRole, viewerUserId),
        // "Masukkan ke total kekayaan" off: the account keeps its own page
        // but stays out of every net-worth figure.
        includeInNetWorth: true,
      },
      select: { balance: true, type: true, name: true },
    });

    const isRestricted = isRowScoped(viewerRole);
    const assetsList = isRestricted
      ? []
      : await this.prisma.asset.findMany({
          // Aset A3/A5 — active, unlinked rows only (linked gold is valued
          // once via its investment; sold/archived is no longer wealth).
          where: { familyGroupId, ...COUNTED_ASSET_WHERE },
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
      viewerRole,
      viewerUserId,
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

    // "Alokasi Kekayaan" covers the whole balance sheet, not just the cash
    // accounts: Investment and Asset rows are separate models that never
    // surface as an `account.type`, so an accounts-only breakdown claimed the
    // family's entire wealth was Rp 252 jt of bank/e-wallet/cash while the
    // hero above it read Rp 2,39 M. `value` is each slice's share of that same
    // three-part total — the old denominator was `netWorth` (assets MINUS
    // liabilities), which made the percentages sum to 13% instead of 100%.
    // Merged BY TYPE, not concatenated: an Account whose own type is already
    // "investment"/"property" shares a slice with the Investment/Asset rows
    // below it, and two entries with the same label would render as duplicate
    // donut segments (and a duplicate React key on the client).
    const allocationByType = new Map(byType);
    const addToType = (type: string, total: number): void => {
      allocationByType.set(type, (allocationByType.get(type) ?? 0) + total);
    };
    addToType("investment", Number(netWorthBreakdown.totalInvestments));
    addToType("property", assetsTotal);

    const allocationBase = Array.from(allocationByType.entries()).filter(
      ([, total]) => total > 0,
    );
    const allocationTotal =
      allocationBase.reduce((sum, [, total]) => sum + total, 0) || 1;
    const allocation: AllocationItemDto[] = allocationBase.map(
      ([type, total]) => ({
        label: ACCOUNT_TYPE_CONFIG[type]?.label ?? type,
        value: Math.round((total / allocationTotal) * 100),
        amount: total,
        color: ACCOUNT_TYPE_CONFIG[type]?.color ?? "#6B7280",
      }),
    );

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
        // Both fragments may contribute a top-level `OR` — combined via
        // `AND` (not object-spread) so neither can clobber the other. See
        // transactions.service.ts#buildWhere for the established pattern.
        AND: [
          transactionPrivacyWhere(canSeePrivate),
          restrictedTransactionWhere(viewerRole, viewerUserId),
        ],
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
    // Month-to-date spending is ONE pass over the COA-EXPENSE rows: the
    // headline `expense` and its category breakdown come from the same
    // accumulation, so the breakdown can never disagree with the total
    // (transfers, debt principal and other TRANSFER-direction rows are not
    // EXPENSE and are excluded from both).
    const expenseByCategory = new Map<string | null, number>();
    let monthExpense = 0;
    for (const tx of currentMonthTx) {
      if (txCoaDirection(tx) !== CoaDirection.EXPENSE) continue;
      const amount = Number(tx.amount);
      monthExpense += amount;
      const name = tx.category?.name ?? null;
      expenseByCategory.set(name, (expenseByCategory.get(name) ?? 0) + amount);
    }
    const expenseBreakdown = Array.from(expenseByCategory.entries())
      .map(([categoryName, amount]) => ({ categoryName, amount }))
      .sort((a, b) => b.amount - a.amount);
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
      // EPIC-023 E3 (D12) — a credit-card purchase has no account. Group E
      // retry (MEDIUM 5) — null, not "" (an empty string rendered as a
      // blank-named row in the recent-activity list).
      accountName: tx.account?.name ?? null,
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
        expenseByCategory: expenseBreakdown,
      },
      recentTransactions,
    };
  }

  /**
   * `viewerRole`/`viewerUserId` (EPIC-023 Task C) — a row-scoped viewer's
   * cash total is restricted to the account(s) they own; Asset/Investment/
   * Liability totals are forced to 0 rather than queried at all, since
   * neither `dependant` nor `operational` holds "read" on those subjects
   * (see casl-ability.factory.ts) — this dashboard rollup must not leak
   * them through a side door.
   */
  private async computeNetWorthBreakdown(
    familyGroupId: string,
    canSeePrivate: boolean,
    viewerRole: ScopeSubject = null,
    viewerUserId?: string,
  ): Promise<NetWorthBreakdown> {
    const isRestricted = isRowScoped(viewerRole);

    const accounts = await this.prisma.account.findMany({
      where: {
        familyGroupId,
        ...accountPrivacyWhere(canSeePrivate),
        ...restrictedAccountWhere(viewerRole, viewerUserId),
        includeInNetWorth: true,
      },
      select: { balance: true },
    });
    const totalCash = accounts.reduce((sum, a) => sum + a.balance, 0n);

    const assets = isRestricted
      ? []
      : await this.prisma.asset.findMany({
          // Aset A3/A5 — active, unlinked rows only (linked gold is valued
          // once via its investment; sold/archived is no longer wealth).
          where: { familyGroupId, ...COUNTED_ASSET_WHERE },
          select: { currentValue: true },
        });
    const totalAssets = assets.reduce((sum, a) => sum + a.currentValue, 0n);

    // Investasi Task 8 — the shared InvestmentValuationService (the one
    // valuation formula, also behind ReportsService's balance sheet and the
    // investments list): market value at today's valuation FX, unpriced
    // holdings at remaining cost (R8, labelled on /investasi). Reads stored
    // prices only — never a live market-data call.
    const totalInvestments = isRestricted
      ? 0n
      : await this.investmentValuation.netWorthTotal(familyGroupId);

    // Asuransi S6 — the shared helper: only confirmed value of policies with
    // includeInNetWorth, counted once; never sum assured or premiums paid.
    // S9 parity with accounts: a row-scoped viewer counts only the policies
    // they can see (holder/payer/insured/share/creator); everyone else gets
    // the family-wide figure.
    const totalInsurance = await this.insuranceNetWorth.total(
      familyGroupId,
      isRestricted
        ? {
            userId: viewerUserId ?? null,
            role:
              viewerRole && typeof viewerRole === "object"
                ? (viewerRole.role ?? null)
                : (viewerRole ?? null),
            rowScoped: true,
          }
        : undefined,
    );

    const liabilityRecords = isRestricted
      ? []
      : await this.prisma.liability.findMany({
          where: { familyGroupId },
          select: { remainingBalance: true },
        });
    const totalLiabilities = liabilityRecords.reduce(
      (sum, l) => sum + l.remainingBalance,
      0n,
    );

    const netWorth =
      totalCash +
      totalInvestments +
      totalAssets +
      totalInsurance -
      totalLiabilities;

    return {
      totalCash,
      totalInvestments,
      totalAssets,
      totalInsurance,
      totalLiabilities,
      netWorth,
    };
  }

  async getNetWorth(
    familyGroupId: string,
    canSeePrivate: boolean,
    viewerRole: ScopeSubject = null,
    viewerUserId?: string,
  ): Promise<NetWorthDto> {
    const b = await this.computeNetWorthBreakdown(
      familyGroupId,
      canSeePrivate,
      viewerRole,
      viewerUserId,
    );
    return {
      accountsTotal: b.totalCash.toString(),
      investmentsTotal: b.totalInvestments.toString(),
      assetsTotal: b.totalAssets.toString(),
      insurancesTotal: b.totalInsurance.toString(),
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
        // The snapshot has no insurance column: policy value rides in
        // totalAssets ("Aset Lainnya" on a historical balance sheet) so
        // cash + investments + assets − liabilities still equals netWorth.
        totalAssets: b.totalAssets + b.totalInsurance,
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
    now: Date = new Date(),
  ): Promise<NetWorthHistoryDto> {
    const since = new Date(now);
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

    // Same UTC day boundary as captureSnapshot, so "today" means the same row key.
    const startOfToday = new Date(now);
    startOfToday.setUTCHours(0, 0, 0, 0);
    const newest = rows[rows.length - 1];
    if (!newest || newest.date.getTime() < startOfToday.getTime()) {
      const b = await this.computeNetWorthBreakdown(familyGroupId, true);
      points.push({
        capturedAt: now.toISOString(),
        totalCash: b.totalCash.toString(),
        totalInvestments: b.totalInvestments.toString(),
        // Same shape as a captured snapshot (insurance inside totalAssets).
        totalAssets: (b.totalAssets + b.totalInsurance).toString(),
        totalLiabilities: b.totalLiabilities.toString(),
        netWorth: b.netWorth.toString(),
      });
    }

    return { range, currency: "IDR", points };
  }
}
