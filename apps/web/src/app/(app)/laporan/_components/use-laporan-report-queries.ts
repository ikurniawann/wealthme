import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { clampDayToMonth, getPeriodDateRange } from "@/lib/laporan-period";
import type { ReportPeriodSelection } from "@/lib/laporan-period";
import type {
  BalanceSheetDto,
  BankReportDto,
  CashflowStatementDto,
  CoaMatrixDto,
  DetailReportDto,
  InvestmentDto,
  InvestmentSummaryDto,
  NetWorthDto,
  PnlDto,
  Pph21ResultDto,
  ReconciliationBridgeDto,
  ReportSummaryDto,
  SankeyDto,
} from "@wealthme/contracts";
import type { CoaAccountOption, FamilyMember } from "./types";

/**
 * EPIC-026 file-split — every `useQuery` `LaporanInner` runs for the report
 * tabs (everything except the investment-CRUD mutations and the export job,
 * which stay in `LaporanInner`/`useExportJob`), extracted verbatim so
 * `laporan-inner.tsx` stays under the file-size convention. Behaviour is
 * unchanged: same query keys, same `enabled` gates, same `staleTime`s —
 * only the code's *location* moved.
 */
export function useLaporanReportQueries({
  familyGroupId,
  token,
  enabled,
  tab,
  period,
  rangeStart,
  rangeEnd,
  summaryAnchorEnd,
  tahunanAnchorEnd,
}: {
  familyGroupId: string;
  token: string | undefined;
  enabled: boolean;
  tab: string;
  period: ReportPeriodSelection;
  rangeStart: string;
  rangeEnd: string;
  summaryAnchorEnd: string;
  tahunanAnchorEnd: string;
}) {
  const SUMMARY_MONTHS = 6;

  const { data: summary, isLoading: isSummaryLoading } =
    useQuery<ReportSummaryDto>({
      // EPIC-023 Task B retry (HIGH) — feeds rsum (the default landing
      // tab), rbulanan, rkas, and rperf; anchored on the active preset's
      // end date (`summaryAnchorEnd`) so those tabs actually change when a
      // preset is selected, not just Bank/Detail/PNL/Cashflow/Aliran Dana.
      queryKey: queryKeys.reports.summary(
        familyGroupId,
        SUMMARY_MONTHS,
        "monthly",
        summaryAnchorEnd,
      ),
      queryFn: () =>
        apiFetch<ReportSummaryDto>(
          `/family-groups/${familyGroupId}/reports/summary?months=${SUMMARY_MONTHS}&endDate=${summaryAnchorEnd}`,
          { token },
        ),
      enabled,
      staleTime: 60_000,
    });

  // EPIC-025 N3-J1 (gap 7) — Ringkasan's "Pemasukan vs Pengeluaran" chart
  // segmented toggle (6 Bln / 12 Bln, prototype's `.segmented`). A second,
  // independent query — NOT a mutation of `SUMMARY_MONTHS` above — so every
  // other tab that shares `summary` (Bulanan, Arus Kas, Performa) keeps its
  // existing trailing-6-month window regardless of what the Ringkasan chart
  // toggle is set to. Only fetched when the 12-month view is actually
  // selected on the Ringkasan tab.
  const [ringkasanChartRange, setRingkasanChartRange] = useState<6 | 12>(6);
  const { data: summary12, isLoading: isSummary12Loading } =
    useQuery<ReportSummaryDto>({
      queryKey: queryKeys.reports.summary(
        familyGroupId,
        12,
        "monthly",
        summaryAnchorEnd,
      ),
      queryFn: () =>
        apiFetch<ReportSummaryDto>(
          `/family-groups/${familyGroupId}/reports/summary?months=12&endDate=${summaryAnchorEnd}`,
          { token },
        ),
      enabled: enabled && tab === "rsum" && ringkasanChartRange === 12,
      staleTime: 60_000,
    });
  const ringkasanChartSummary =
    ringkasanChartRange === 12 ? summary12 : summary;
  const isRingkasanChartLoading =
    ringkasanChartRange === 12 ? isSummary12Loading : isSummaryLoading;

  // Laporan Harian always needs one specific day. Default to "today's
  // day-of-month" (clamped into the selected month) until the shared filter
  // pins a day, so the tab keeps showing today's data by default and stays
  // in sync with the header filter once the user picks a period.
  const harianDay =
    period.day ??
    clampDayToMonth(period.year, period.month, new Date().getDate());
  const harianDate = `${period.year}-${String(period.month).padStart(2, "0")}-${String(harianDay).padStart(2, "0")}`;
  const { startDate: harianStart, endDate: harianEnd } = getPeriodDateRange({
    year: period.year,
    month: period.month,
    day: harianDay,
  });

  const { data: bankReport, isLoading: isBankLoading } =
    useQuery<BankReportDto>({
      queryKey: queryKeys.reports.bank(familyGroupId, rangeStart, rangeEnd),
      queryFn: () =>
        apiFetch<BankReportDto>(
          `/family-groups/${familyGroupId}/reports/bank?startDate=${rangeStart}&endDate=${rangeEnd}`,
          { token },
        ),
      enabled: enabled && tab === "rbank",
      staleTime: 60_000,
    });

  const { data: detailReport, isLoading: isDetailLoading } =
    useQuery<DetailReportDto>({
      queryKey: queryKeys.reports.detail(familyGroupId, rangeStart, rangeEnd),
      queryFn: () =>
        apiFetch<DetailReportDto>(
          `/family-groups/${familyGroupId}/reports/detail?startDate=${rangeStart}&endDate=${rangeEnd}`,
          { token },
        ),
      enabled: enabled && tab === "rdetail",
      staleTime: 60_000,
    });

  const { data: dailyReport, isLoading: isDailyLoading } =
    useQuery<DetailReportDto>({
      queryKey: queryKeys.reports.detail(familyGroupId, harianStart, harianEnd),
      queryFn: () =>
        apiFetch<DetailReportDto>(
          `/family-groups/${familyGroupId}/reports/detail?startDate=${harianStart}&endDate=${harianEnd}`,
          { token },
        ),
      enabled: enabled && tab === "rharian",
      staleTime: 30_000,
    });

  const { data: pnl, isLoading: isPnlLoading } = useQuery<PnlDto>({
    queryKey: queryKeys.reports.pnl(familyGroupId, rangeStart, rangeEnd),
    queryFn: () =>
      apiFetch<PnlDto>(
        `/family-groups/${familyGroupId}/reports/pnl?startDate=${rangeStart}&endDate=${rangeEnd}`,
        { token },
      ),
    enabled: enabled && tab === "rpnl",
    staleTime: 60_000,
  });

  const { data: balanceSheet, isLoading: isBalanceLoading } =
    useQuery<BalanceSheetDto>({
      // Balance Sheet is point-in-time: `asOfDate` uses the selected period's
      // end bound (the pinned day, or the selected month's last day).
      queryKey: queryKeys.reports.balanceSheet(familyGroupId, rangeEnd),
      queryFn: () =>
        apiFetch<BalanceSheetDto>(
          `/family-groups/${familyGroupId}/reports/balance-sheet?asOfDate=${rangeEnd}`,
          { token },
        ),
      enabled:
        enabled && (tab === "rbalance" || tab === "rasl" || tab === "rsum"),
      staleTime: 60_000,
    });

  // EPIC-023 Task B (B3, D24, US-RPT-11) — reconciles the period's profit
  // against its actual net-worth change, surfaced on the Balance Sheet tab.
  const { data: reconciliationBridge, isLoading: isBridgeLoading } =
    useQuery<ReconciliationBridgeDto>({
      queryKey: queryKeys.reports.reconciliationBridge(
        familyGroupId,
        rangeStart,
        rangeEnd,
      ),
      queryFn: () =>
        apiFetch<ReconciliationBridgeDto>(
          `/family-groups/${familyGroupId}/reports/reconciliation-bridge?startDate=${rangeStart}&endDate=${rangeEnd}`,
          { token },
        ),
      enabled: enabled && tab === "rbalance",
      staleTime: 60_000,
    });

  const { data: cashflow, isLoading: isCashflowLoading } =
    useQuery<CashflowStatementDto>({
      queryKey: queryKeys.reports.cashflow(familyGroupId, rangeStart, rangeEnd),
      queryFn: () =>
        apiFetch<CashflowStatementDto>(
          `/family-groups/${familyGroupId}/reports/cashflow?startDate=${rangeStart}&endDate=${rangeEnd}`,
          { token },
        ),
      enabled: enabled && tab === "rcashflow",
      staleTime: 60_000,
    });

  const { data: sankeyData, isLoading: isSankeyLoading } = useQuery<SankeyDto>({
    queryKey: queryKeys.reports.sankey(familyGroupId, rangeStart, rangeEnd),
    queryFn: () =>
      apiFetch<SankeyDto>(
        `/family-groups/${familyGroupId}/reports/sankey?startDate=${rangeStart}&endDate=${rangeEnd}`,
        { token },
      ),
    enabled: enabled && tab === "raliran",
    staleTime: 60_000,
  });

  // EPIC-023 Task B retry (HIGH) — like rfamily below, rinv's holdings list
  // has no period semantics: `/investments` returns the family's CURRENT
  // portfolio (no `asOfDate`/`startDate`/`endDate` param on the endpoint),
  // so there is no "last month's holdings" to show. Left un-wired,
  // deliberately, same reasoning as the rfamily comment further down; the
  // preset selector's inapplicability is disclosed on-screen for both tabs
  // (see `periodNotApplicableNote` usage in the header below).
  const { data: investments, isLoading: isInvLoading } = useQuery<
    InvestmentDto[]
  >({
    queryKey: queryKeys.investments.all(familyGroupId),
    queryFn: () =>
      apiFetch<InvestmentDto[]>(`/family-groups/${familyGroupId}/investments`, {
        token,
      }),
    enabled: enabled && tab === "rinv",
    staleTime: 60_000,
  });

  const { data: invSummary } = useQuery<InvestmentSummaryDto>({
    queryKey: queryKeys.investments.summary(familyGroupId),
    queryFn: () =>
      apiFetch<InvestmentSummaryDto>(
        `/family-groups/${familyGroupId}/investments/summary`,
        { token },
      ),
    enabled: enabled && (tab === "rinv" || tab === "rsum" || tab === "rperf"),
    staleTime: 60_000,
  });

  // Tahunan (year granularity): re-anchors the same trend endpoint at the
  // selected year's end instead of always ending at "now" — or, when a
  // range preset is active, at that preset's own end (EPIC-023 Task B
  // retry, HIGH — rtahunan used to ignore the preset selector entirely).
  const { data: yearlySummary, isLoading: isYearlyLoading } =
    useQuery<ReportSummaryDto>({
      queryKey: queryKeys.reports.summary(
        familyGroupId,
        3,
        "yearly",
        tahunanAnchorEnd,
      ),
      queryFn: () =>
        apiFetch<ReportSummaryDto>(
          `/family-groups/${familyGroupId}/reports/summary?months=3&period=yearly&endDate=${tahunanAnchorEnd}`,
          { token },
        ),
      enabled: enabled && tab === "rtahunan",
      staleTime: 300_000,
    });

  // T-902: Group Family consolidated report (member roster + group totals).
  // The member roster and group net-worth snapshot have no period semantics
  // (roster is point-in-time membership; net-worth has no date param on the
  // current /dashboard/net-worth endpoint) — left un-wired, documented here.
  const { data: familyMembers, isLoading: isFamilyLoading } = useQuery<
    FamilyMember[]
  >({
    queryKey: queryKeys.familyGroups.members(familyGroupId),
    queryFn: () =>
      apiFetch<FamilyMember[]>(`/family-groups/${familyGroupId}/members`, {
        token,
      }),
    enabled: enabled && tab === "rfamily",
    staleTime: 60_000,
  });

  // EPIC-022 (adversarial review round 3, item 2) — also enabled for
  // "rbalance": BalanceSection cross-checks the balance sheet's `netWorth`
  // against this dashboard figure, a genuinely independent computation
  // (different service, different query path — DashboardService's
  // computeNetWorthBreakdown vs ReportsService's getBalanceSheet) instead of
  // an in-payload identity that can never disagree with itself.
  const { data: familyNetWorth, isLoading: isNetWorthLoading } =
    useQuery<NetWorthDto>({
      queryKey: queryKeys.netWorth.summary(familyGroupId),
      queryFn: () =>
        apiFetch<NetWorthDto>(
          `/family-groups/${familyGroupId}/dashboard/net-worth`,
          { token },
        ),
      enabled: enabled && (tab === "rfamily" || tab === "rbalance"),
      staleTime: 60_000,
    });

  // T-903: PPh 21 estimate from the trailing 12 months. Anchoring the trend
  // on `summaryAnchorEnd` makes the estimate re-query for the selected
  // period (EPIC-023 Task B retry, HIGH — rpajak used to ignore the
  // preset selector entirely).
  const { data: annualSummary, isLoading: isAnnualLoading } =
    useQuery<ReportSummaryDto>({
      queryKey: queryKeys.reports.summary(
        familyGroupId,
        12,
        "monthly",
        summaryAnchorEnd,
      ),
      queryFn: () =>
        apiFetch<ReportSummaryDto>(
          `/family-groups/${familyGroupId}/reports/summary?months=12&period=monthly&endDate=${summaryAnchorEnd}`,
          { token },
        ),
      enabled: enabled && tab === "rpajak",
      staleTime: 300_000,
    });

  const annualGross = annualSummary?.totalIncome;

  const { data: pph21, isLoading: isPph21Loading } = useQuery<Pph21ResultDto>({
    queryKey: ["calculators", "pph21", familyGroupId, annualGross ?? 0],
    queryFn: () =>
      apiFetch<Pph21ResultDto>("/calculators/pph21", {
        method: "POST",
        token,
        body: JSON.stringify({ grossIncome: annualGross ?? 0 }),
      }),
    enabled:
      enabled && tab === "rpajak" && annualGross != null && annualGross > 0,
    staleTime: 300_000,
  });

  // EPIC-024 Task M (M2, D16, US-RPT-14) — Laporan COA picker state + queries.
  const [coaAccountId, setCoaAccountId] = useState("");
  const [coaYear, setCoaYear] = useState(() => new Date().getFullYear());

  const { data: coaAccounts = [], isLoading: isCoaAccountsLoading } = useQuery<
    CoaAccountOption[]
  >({
    queryKey: ["coa-accounts", familyGroupId],
    queryFn: () =>
      apiFetch<CoaAccountOption[]>(
        `/family-groups/${familyGroupId}/coa-accounts`,
        { token },
      ),
    enabled: enabled && tab === "rcoa",
    staleTime: 60_000,
  });

  const activeCoaAccountId = coaAccountId || coaAccounts[0]?.id || "";

  const { data: coaMatrix, isLoading: isCoaMatrixLoading } =
    useQuery<CoaMatrixDto>({
      queryKey: queryKeys.reports.coaMatrix(
        familyGroupId,
        activeCoaAccountId,
        coaYear,
      ),
      queryFn: () =>
        apiFetch<CoaMatrixDto>(
          `/family-groups/${familyGroupId}/reports/coa-matrix?coaAccountId=${activeCoaAccountId}&year=${coaYear}`,
          { token },
        ),
      enabled: enabled && tab === "rcoa" && Boolean(activeCoaAccountId),
      staleTime: 60_000,
    });

  return {
    summary,
    isSummaryLoading,
    ringkasanChartRange,
    setRingkasanChartRange,
    ringkasanChartSummary,
    isRingkasanChartLoading,
    harianDate,
    dailyReport,
    isDailyLoading,
    bankReport,
    isBankLoading,
    detailReport,
    isDetailLoading,
    pnl,
    isPnlLoading,
    balanceSheet,
    isBalanceLoading,
    reconciliationBridge,
    isBridgeLoading,
    cashflow,
    isCashflowLoading,
    sankeyData,
    isSankeyLoading,
    investments,
    isInvLoading,
    invSummary,
    yearlySummary,
    isYearlyLoading,
    familyMembers,
    isFamilyLoading,
    familyNetWorth,
    isNetWorthLoading,
    annualGross,
    isAnnualLoading,
    pph21,
    isPph21Loading,
    coaAccountId: activeCoaAccountId,
    setCoaAccountId,
    coaYear,
    setCoaYear,
    coaAccounts,
    isCoaAccountsLoading,
    coaMatrix,
    isCoaMatrixLoading,
  };
}
