"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-compat";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useLocale } from "@/hooks/use-locale";
import { useCurrencyPreference } from "@/hooks/use-currency-preference";
import { formatRupiah, formatRupiahCompact } from "@/lib/format";
import type {
  AccountDto,
  AllowanceRequestDto,
  BudgetDto,
  DashboardSummaryDto,
  GoalDto,
  LiabilityDto,
  NetWorthDto,
  NetWorthHistoryDto,
} from "@wealthme/contracts";
import { getSetupChecklistState } from "./setup-checklist";

/**
 * EPIC-026 Wave 8 — every `/beranda` query and every value derived from one.
 * Extracted verbatim from the old single-file `page.tsx` so the bento section
 * components stay presentational; the provenance comments on each query are
 * carried over unchanged.
 */

// EPIC-025 N3 fidelity follow-up — prototype's Arus Kas card carries a
// "6 Bln / 12 Bln" toggle instead of the hero's 1M/3M/6M/1Y/All pills. The
// toggle still drives the same range-parametrized net-worth-history query
// the hero sparkline already renders (there is no 12-month CASHFLOW feed —
// `DashboardSummaryDto.cashflow` is a fixed 6-month backend rollup with no
// range param, and adding one is backend work out of this page-only pass).
export const PERIODS = ["6M", "12M"] as const;

export type BerandaPeriod = (typeof PERIODS)[number];

const PERIOD_RANGE: Record<BerandaPeriod, string> = {
  "6M": "6m",
  "12M": "12m",
};

/** Liquid account types, per the prototype's "Aset Likuid" snapshot row. */
const LIQUID_TYPES = new Set(["cash", "ewallet", "bank"]);

export type MoneyFormatters = {
  /** Full Rupiah (or an indicative foreign-currency approximation). */
  money: (value: number) => string;
  /** Compact "Rp 1,2 jt" form of the same value. */
  moneyCompact: (value: number) => string;
  currency: string;
  isIndicative: boolean;
  isReady: boolean;
  formatMoney: (value: number) => string;
};

/**
 * Every monetary display on this page routes through these two helpers so
 * conversion coverage stays consistent — never a fabricated 1:1-rate number
 * rendered under a foreign currency symbol while the FX rate is still loading
 * (or failed to load).
 */
export function useMoneyFormatters(): MoneyFormatters {
  const { t } = useLocale();
  const { currency, formatMoney, isIndicative, isReady } =
    useCurrencyPreference();

  const money = (value: number): string =>
    !isReady
      ? t.common.loading
      : isIndicative
        ? `≈ ${formatMoney(value)}`
        : formatRupiah(value);

  const moneyCompact = (value: number): string =>
    !isReady
      ? t.common.loading
      : isIndicative
        ? `≈ ${formatMoney(value)}`
        : formatRupiahCompact(value);

  return { money, moneyCompact, currency, isIndicative, isReady, formatMoney };
}

export type AllocationItem = {
  label: string;
  amount: number;
  /** Percentage share, as the API returns it — used for the aria label. */
  percent: number;
  /** API-provided colour, kept only as the pre-mount donut fallback. */
  apiColor: string;
};

/** The fields of `/members` the Beranda family row reads. */
export type BerandaMember = {
  id: string;
  userId: string;
  role: string;
  name: string;
};

export function useBerandaData(period: BerandaPeriod) {
  const { data: session } = useSession();
  const familyGroupId = session?.familyGroupId ?? null;
  const enabled = Boolean(familyGroupId) && Boolean(session?.accessToken);
  const token = session?.accessToken;

  const {
    data: summary,
    isLoading,
    isError,
    isSuccess: isSummaryReady,
  } = useQuery<DashboardSummaryDto>({
    queryKey: queryKeys.dashboard.summary(familyGroupId ?? ""),
    queryFn: () =>
      apiFetch<DashboardSummaryDto>(
        `/family-groups/${familyGroupId}/dashboard/summary`,
        { token },
      ),
    enabled,
    staleTime: 60_000,
  });

  const range = PERIOD_RANGE[period];
  // ponytail: inline key — lib/query-keys.ts is a protected foundation file.
  const { data: netWorthHistory, isLoading: isHistoryLoading } =
    useQuery<NetWorthHistoryDto>({
      queryKey: ["dashboard", familyGroupId ?? "", "net-worth-history", range],
      queryFn: () =>
        apiFetch<NetWorthHistoryDto>(
          `/family-groups/${familyGroupId}/dashboard/net-worth/history?range=${range}`,
          { token },
        ),
      enabled,
      staleTime: 60_000,
    });

  // EPIC-025 N3-G1 — bento-hero footer metric ("Liabilitas"). Same
  // `/dashboard/net-worth` endpoint `ringkasan` already fetches; only
  // `liabilitiesTotal` is read here (no new backend work, per Ground Truth).
  const { data: netWorthData } = useQuery<NetWorthDto>({
    queryKey: queryKeys.netWorth.summary(familyGroupId ?? ""),
    queryFn: () =>
      apiFetch<NetWorthDto>(
        `/family-groups/${familyGroupId}/dashboard/net-worth`,
        { token },
      ),
    enabled,
    staleTime: 60_000,
  });

  // EPIC-025 N3 fidelity follow-up — "Perlu Perhatian" card
  // (`docs/prototype/pages/beranda.html`'s `.bento-side` second article).
  // Both queries below already exist and are already fetched by
  // /persetujuan and /liabilitas respectively — no new backend work.
  const { data: allowanceRequests } = useQuery<AllowanceRequestDto[]>({
    queryKey: queryKeys.allowanceRequests.all(familyGroupId ?? ""),
    queryFn: () =>
      apiFetch<AllowanceRequestDto[]>(
        `/family-groups/${familyGroupId}/allowance-requests`,
        { token },
      ),
    enabled,
    staleTime: 60_000,
  });

  const { data: liabilities } = useQuery<LiabilityDto[]>({
    queryKey: queryKeys.liabilities.all(familyGroupId ?? ""),
    queryFn: () =>
      apiFetch<LiabilityDto[]>(`/family-groups/${familyGroupId}/liabilities`, {
        token,
      }),
    enabled,
    staleTime: 60_000,
  });

  // EPIC-025 N3 fidelity follow-up — "Anggaran <Bulan>" card
  // (`docs/prototype/pages/beranda.html`'s `.bento-side` first article).
  // Same `/budgets` endpoint `/anggaran` already fetches.
  const { data: budgets, isLoading: isBudgetsLoading } = useQuery<BudgetDto[]>({
    queryKey: queryKeys.budgets.all(familyGroupId ?? ""),
    queryFn: () =>
      apiFetch<BudgetDto[]>(`/family-groups/${familyGroupId}/budgets`, {
        token,
      }),
    enabled,
    staleTime: 60_000,
  });

  const { data: goals, isLoading: isGoalsLoading } = useQuery<GoalDto[]>({
    queryKey: queryKeys.goals.all(familyGroupId ?? ""),
    queryFn: ({ signal }) =>
      apiFetch<GoalDto[]>(`/family-groups/${familyGroupId}/goals`, {
        token,
        signal,
      }),
    enabled,
    staleTime: 60_000,
  });

  const { data: setupAccounts, isSuccess: isSetupAccountsReady } = useQuery<
    AccountDto[]
  >({
    queryKey: queryKeys.accounts.all(familyGroupId ?? ""),
    queryFn: () =>
      apiFetch<AccountDto[]>(`/family-groups/${familyGroupId}/accounts`, {
        token,
      }),
    enabled,
    staleTime: 60_000,
  });

  const { data: setupMembers, isSuccess: isSetupMembersReady } = useQuery<
    BerandaMember[]
  >({
    queryKey: queryKeys.familyGroups.members(familyGroupId ?? ""),
    queryFn: () =>
      apiFetch<BerandaMember[]>(`/family-groups/${familyGroupId}/members`, {
        token,
      }),
    enabled,
    staleTime: 60_000,
  });

  const setupChecklist = getSetupChecklistState({
    hasAccount: Boolean(setupAccounts?.length),
    hasBudget: Boolean(budgets?.length),
    hasTransaction: Boolean(summary?.recentTransactions.length),
    hasFamilyMember:
      (setupMembers ?? []).filter((member) => member.role !== "admin_staff")
        .length > 1,
    hasGoal: Boolean(goals?.length),
  });
  const isSetupChecklistReady =
    Boolean(familyGroupId) &&
    isSummaryReady &&
    !isBudgetsLoading &&
    !isGoalsLoading &&
    isSetupAccountsReady &&
    isSetupMembersReady;

  // ── Derivations (all from data already fetched above) ──────────────────

  const accountSummary = useMemo(
    () => summary?.accountSummary ?? [],
    [summary],
  );

  // `summary.assetsTotal`/`accountSummary` are built server-side purely
  // from the `Account` table — Investment holdings live in a separate
  // model and never appear as an `account.type`, so grouping by
  // `accountSummary` alone silently drops them (the Investasi stat tile
  // read Rp 0 and "Total Aset" undercounted by the whole portfolio value).
  // `/dashboard/net-worth` (already fetched above for `totalLiabilities`)
  // carries the correct, investment-inclusive totals used by
  // /ringkasan and /aset — reuse those instead of re-deriving here.
  const investasiTotal = Number(netWorthData?.investmentsTotal ?? 0);
  const cashAccountsTotal = Number(netWorthData?.accountsTotal ?? 0);
  const physicalAssetsTotal = Number(netWorthData?.assetsTotal ?? 0);
  const assetsTotal = cashAccountsTotal + investasiTotal + physicalAssetsTotal;
  const totalLiabilities = Number(netWorthData?.liabilitiesTotal ?? 0);

  const sumOf = (matches: (type: string) => boolean): number =>
    accountSummary
      .filter((s) => matches(s.type))
      .reduce((a, s) => a + s.total, 0);

  const liquidTotal = sumOf((type) => LIQUID_TYPES.has(type));
  // Everything that is not a liquid account: non-liquid accounts, the
  // investment portfolio AND the physical assets (rumah, kendaraan, …).
  // Deriving it as a remainder rather than re-summing `accountSummary` is
  // what keeps `liquidPct + nonLiquidPct` at exactly 100% — the two rows sit
  // side by side under one "Total Aset", so any slice missed here shows up as
  // a snapshot that visibly fails to add up.
  const nonLiquidTotal = assetsTotal - liquidTotal;
  const pctOfAssets = (part: number): number =>
    assetsTotal > 0 ? Math.round((part / assetsTotal) * 1000) / 10 : 0;

  // EPIC-025 N3 fidelity follow-up — the prototype's 4 stat cards.
  // `cashEwalletTotal` merges the two liquid account types the backend
  // returns separately; the liabilities figure reuses `totalLiabilities`
  // (a liability, not an account, so not part of `accountSummary`).
  const cashEwalletTotal = sumOf(
    (type) => type === "cash" || type === "ewallet",
  );
  const bankTotal = sumOf((type) => type === "bank");

  const allocation: AllocationItem[] = useMemo(
    () =>
      (summary?.allocation ?? []).map((item) => ({
        label: item.label,
        amount: item.amount,
        percent: item.value,
        apiColor: item.color,
      })),
    [summary],
  );

  // "Perlu Perhatian" notices — same derivations liabilitas/persetujuan
  // already compute client-side from their own fetched lists.
  const pendingApprovalsCount = (allowanceRequests ?? []).filter(
    (r) => r.status === "pending",
  ).length;

  // E2E round 1 bug 2 — prefer the real `nextDueDate` over the legacy
  // manual `dueDate` field the KPR form never sets.
  const nearestDueLiability = (liabilities ?? [])
    .filter((l) => l.nextDueDate ?? l.dueDate)
    .sort((a, b) =>
      (a.nextDueDate ?? a.dueDate ?? "").localeCompare(
        b.nextDueDate ?? b.dueDate ?? "",
      ),
    )[0];

  return {
    isLoading,
    isError,
    summary,
    currentMonth: summary?.currentMonth,
    cashflow: summary?.cashflow,
    netWorth: summary?.netWorth ?? 0,
    recentTransactions: summary?.recentTransactions ?? [],
    assetsTotal,
    totalLiabilities,
    liquidTotal,
    nonLiquidTotal,
    liquidPct: pctOfAssets(liquidTotal),
    nonLiquidPct: pctOfAssets(nonLiquidTotal),
    cashEwalletTotal,
    bankTotal,
    investasiTotal,
    historyPoints: netWorthHistory?.points ?? [],
    isHistoryLoading,
    allocation,
    pendingApprovalsCount,
    nearestDueLiability,
    budgets: budgets ?? [],
    isBudgetsLoading,
    goals: goals ?? [],
    isGoalsLoading,
    setupChecklist,
    isSetupChecklistReady,
    accounts: setupAccounts ?? [],
    isAccountsLoading: !isSetupAccountsReady,
    members: (setupMembers ?? []).filter(
      (member) => member.role !== "admin_staff",
    ),
    liabilities: liabilities ?? [],
  };
}
