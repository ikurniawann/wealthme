"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Download, Search } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-compat";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useLocale } from "@/hooks/use-locale";
import { useApiError } from "@/hooks/use-api-error";
import { REPORT_TABS, type ReportTabId } from "@/lib/nav";
import { useMoney } from "@/hooks/use-money";
import { DateField, Segmented } from "@/components/wm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { HatchedBarChart } from "@/components/charts/bento-charts";
import { EXPENSE_COLOR } from "@/lib/viz-colors";
import { coverFor } from "./report-cover";
import { REPORT_ICONS } from "./report-icons";
import {
  getPeriodDateRange,
  getYearDateRange,
  resolvePreset,
  type ReportPeriodSelection,
  type ReportRangePreset,
  wibDateOf,
} from "@/lib/laporan-period";
import {
  canonicalToTyping,
  moneyIdrDecimal,
  toCanonicalAmount,
  useControlledMoneyField,
  withFxInputs,
} from "@/components/money";

import type {
  FxCurrencyCode,
  InvestmentDto,
  InvestmentType,
} from "@wealthme/contracts";
import { EXPORT_TYPE_FOR_TAB, useExportJob } from "./export-section";
import { useLaporanReportQueries } from "./use-laporan-report-queries";
import { InvestmentDialogs } from "./investment-dialogs";
import { RangePresetSelect } from "./period-filter";
import { formatDateRangeLabel } from "@/components/wm/date-range-field";
import { RingkasanSection } from "./sections/ringkasan-section";
import { HarianSection } from "./sections/harian-section";
import { BulananSection } from "./sections/bulanan-section";
import { TahunanSection } from "./sections/tahunan-section";
import { FamilySection } from "./sections/family-section";
import { BankSection } from "./sections/bank-section";
import { DetailSection } from "./sections/detail-section";
import { AliranSection } from "./sections/aliran-section";
import { PnlSection } from "./sections/pnl-section";
import { BalanceSection } from "./sections/balance-section";
import { CashflowSection } from "./sections/cashflow-section";
import { KasSection } from "./sections/kas-section";
import { InvSection } from "./sections/inv-section";
import { AslSection } from "./sections/asl-section";
import { PerfSection } from "./sections/perf-section";
import { PajakSection } from "./sections/pajak-section";
import { CoaSection } from "./sections/coa-section";
import { REPORT_GROUPS, getReportGroupForTab } from "./report-groups";

/** "1 Sep" / "30 Sep 2026" for the cover's period caption. */
function fmtDay(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Jakarta",
  });
}

/* ───────────────────────── Page shell ───────────────────────── */

export function LaporanInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const tab = sp.get("tab") ?? "rsum";
  const { t, locale } = useLocale();

  const { data: session } = useSession();
  const familyGroupId = session?.familyGroupId ?? "";
  const accessToken = session?.accessToken;

  const enabled = Boolean(familyGroupId) && Boolean(session?.accessToken);
  const token = session?.accessToken;

  // Shared year/month(/day) period filter (EPIC-020 Task B) — one native
  // control set in the page header drives every report section below.
  // Default = current month/year (today's prior hard-coded behavior).
  const [period, setPeriod] = useState<ReportPeriodSelection>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1, day: null };
  });

  // EPIC-023 Task B (B1, US-RPT-12) — date-range presets, applied across
  // every /laporan sub-view. "custom" hands control back to the year/
  // month/day `PeriodFilter` above (today's prior default behavior);
  // anything else overrides `rangeStart`/`rangeEnd` below. `now` is frozen
  // per preset selection (not recomputed every render) so the derived
  // query keys stay stable instead of refetching on every re-render.
  // Prototype default is "Bulan Ini" (`<option value="bulan-ini" selected>`),
  // not "Custom" — with "custom" the filter opened on the year/month/day
  // selects and `presetRange` was null, so every trend query silently fell
  // back to the month anchor instead of an explicit range.
  const [rangePreset, setRangePreset] =
    useState<ReportRangePreset>("last6Months");
  // EPIC-023 Task B retry (MEDIUM) — the "to-date" presets (This Month/
  // Year, Last N Months) end at `now`, frozen at the moment `resolvePreset`
  // last ran. Recompute it when the tab regains focus/visibility so a long-
  // lived session doesn't keep showing yesterday's "today" after a day
  // rollover — a full re-derivation on every render would defeat the
  // "stable query keys" reason `now` is frozen in the first place, so this
  // is bounded to focus/visibility events only, not every render.
  const [focusTick, setFocusTick] = useState(0);
  useEffect(() => {
    function recompute() {
      setFocusTick((n) => n + 1);
    }
    window.addEventListener("focus", recompute);
    document.addEventListener("visibilitychange", recompute);
    return () => {
      window.removeEventListener("focus", recompute);
      document.removeEventListener("visibilitychange", recompute);
    };
  }, []);
  // `focusTick` is an intentional recompute trigger (not a value
  // `resolvePreset` itself reads), so it is force-included in the deps
  // array below to invalidate the memo on focus/visibility change.
  // Prototype parity: "Rentang Tanggal" is a real date-range PICKER that is
  // always visible, and applying one flips Periode to "Custom" (see
  // docs/prototype/pages/laporan.html — `WM.mountDateRange`'s `onApply` sets
  // `#f-preset` to `custom`). Custom therefore now resolves to a real range
  // through `resolvePreset`'s own WIB-pinned `custom` branch, instead of
  // returning null and falling back to the year/month/day selects.
  const [customRange, setCustomRange] = useState<{
    from: string;
    to: string;
  } | null>(null);

  // Bento v2 filter (prototype laporan.html): Tahun + Bulan pick one whole
  // calendar month (applied as a custom range); Rentang picks a preset.
  const filterYear = customRange
    ? Number(customRange.from.slice(0, 4))
    : new Date().getFullYear();
  const filterMonth = customRange
    ? Number(customRange.from.slice(5, 7))
    : new Date().getMonth() + 1;
  const filterYears = Array.from(
    { length: 6 },
    (_, k) => new Date().getFullYear() - k,
  );
  function pickMonth(year: number, month: number) {
    const mm = String(month).padStart(2, "0");
    const last = new Date(year, month, 0).getDate();
    setCustomRange({
      from: `${year}-${mm}-01`,
      to: `${year}-${mm}-${String(last).padStart(2, "0")}`,
    });
    setRangePreset("custom");
  }

  // Phones (<=720px): the Tahun/Bulan/Rentang selects collapse into one
  // "Periode" button that opens a bottom sheet. The sheet edits a DRAFT of the
  // same inputs and commits through the exact handlers the desktop selects use
  // (`pickMonth` / `setRangePreset`), so the report logic is untouched. The
  // last control touched wins, mirroring the desktop semantics where picking a
  // month flips the preset to "custom" and picking a preset overrides it.
  const [periodSheetOpen, setPeriodSheetOpen] = useState(false);
  const [draftYear, setDraftYear] = useState(filterYear);
  const [draftMonth, setDraftMonth] = useState(filterMonth);
  const [draftPreset, setDraftPreset] =
    useState<ReportRangePreset>(rangePreset);
  const [draftMode, setDraftMode] = useState<"month" | "preset">("preset");
  function openPeriodSheet() {
    setDraftYear(filterYear);
    setDraftMonth(filterMonth);
    setDraftPreset(rangePreset);
    setDraftMode("preset");
    setPeriodSheetOpen(true);
  }
  function applyPeriodSheet() {
    if (draftMode === "month") pickMonth(draftYear, draftMonth);
    else setRangePreset(draftPreset);
    setPeriodSheetOpen(false);
  }
  function resetPeriodSheet() {
    setCustomRange(null);
    setRangePreset("last6Months");
    setPeriodSheetOpen(false);
  }

  // Phones: the report chips scroll horizontally and the grouped dropdown is
  // hidden, so keep the active chip in view after a switch.
  useEffect(() => {
    if (!window.matchMedia("(max-width: 900px)").matches) return;
    document
      .getElementById(`laporan-tab-${tab}`)
      ?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [tab]);

  const presetRange = useMemo(() => {
    if (rangePreset !== "custom") return resolvePreset(rangePreset);
    if (!customRange) return null; // nothing applied yet — keep today's fallback
    const [fy, fm, fd] = customRange.from.split("-").map(Number);
    const [ty, tm, td] = customRange.to.split("-").map(Number);
    return resolvePreset("custom", new Date(), {
      start: { year: fy, month: fm, day: fd },
      end: { year: ty, month: tm, day: td },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangePreset, customRange, focusTick]);

  // Range-style sections (Bank/Detail/PNL/Cashflow/Aliran Dana, Balance
  // Sheet's as-of date, and the Reconciliation Bridge) narrow to a single
  // day when the filter pins one; otherwise they span the whole selected
  // month, or the active preset's window when one is selected.
  const { startDate: periodRangeStart, endDate: periodRangeEnd } =
    getPeriodDateRange(period);
  const rangeStart = presetRange?.startDate ?? periodRangeStart;
  const rangeEnd = presetRange?.endDate ?? periodRangeEnd;
  // Trend-style "N months back" summary queries are always monthly-bucketed
  // server-side — they anchor on the selected month's end regardless of any
  // pinned day (a single day has no meaning for a multi-month trend).
  const { endDate: monthAnchorEnd } = getPeriodDateRange({
    year: period.year,
    month: period.month,
    day: null,
  });
  // Tahunan re-queries the same trend anchored at the selected year's end —
  // but for the current (or a future) year, "the selected year's end" is
  // Dec 31, a date that hasn't happened yet. Anchoring a trailing-3-month
  // query there pulls Oct/Nov/Dec of a year still in progress, i.e. three
  // empty future months (bug: "Laporan Tahunan" showing Rp 0 / an empty
  // chart every August). Clamp to "today" whenever the calendar year-end is
  // still in the future, matching every other trend-style anchor's "never
  // query past today" contract (see `resolvePreset`'s to-date presets).
  // `focusTick`-scoped so "today" stays a stable string across renders (not
  // a fresh `new Date()` every render, which would thrash the query key).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- focusTick is an intentional recompute trigger (not a value the callback itself reads), same as presetRange above.
  const todayIso = useMemo(() => new Date().toISOString(), [focusTick]);
  const { endDate: yearEndRaw } = getYearDateRange(period.year);
  const yearAnchorEnd = yearEndRaw < todayIso ? yearEndRaw : todayIso;
  // EPIC-023 Task B retry (HIGH) — B1 previously only drove
  // rbank/rdetail/rpnl/rbalance/rasl/rcashflow/raliran via `rangeStart`/
  // `rangeEnd`; rsum/rbulanan/rkas/rperf/rtahunan/rpajak still anchored on
  // the year/month/day filter alone, so picking a preset on those tabs
  // (rsum is the DEFAULT landing tab) silently changed nothing. Every
  // trend-style ("N months/years back") query below now anchors on the
  // active preset's own end date when one is selected, falling back to the
  // year/month/day filter's anchor for "custom".
  const summaryAnchorEnd = presetRange ? rangeEnd : monthAnchorEnd;
  const tahunanAnchorEnd = presetRange ? rangeEnd : yearAnchorEnd;
  // Human-readable caption for the range-based sections (Aliran Dana/PNL/
  // Cashflow) so their heading always matches the period actually queried —
  // the active preset's own label when one is selected, else the year/
  // month/day filter's period.
  // The prototype's `#lbl-periode` is always a date RANGE ("1 – 31 Agustus
  // 2026") — every PRESETS entry carries one, and applying a custom range
  // copies the picker's own label into it. It never shows a preset's NAME.
  // Derived from the same bounds the queries use, so the disclosure and the
  // data can never disagree.
  const periodLabel = formatDateRangeLabel(
    wibDateOf(rangeStart),
    wibDateOf(rangeEnd),
    locale,
  );

  // EPIC-026 file-split — every report `useQuery` extracted verbatim into
  // `useLaporanReportQueries` so this file stays under the size convention;
  // same query keys/enabled gates/staleTimes, only the location moved.
  const {
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
    coaAccountId,
    setCoaAccountId,
    coaYear,
    setCoaYear,
    coaAccounts,
    isCoaAccountsLoading,
    coaMatrix,
    isCoaMatrixLoading,
  } = useLaporanReportQueries({
    familyGroupId,
    token,
    enabled,
    tab,
    period,
    rangeStart,
    rangeEnd,
    summaryAnchorEnd,
    tahunanAnchorEnd,
  });

  // Intentional cross-tab effect: picking a Harian date pins `period.day`
  // globally (not just for this tab), so Bank/Detail/PNL/Cashflow/Sankey and
  // Balance Sheet's as-of date all narrow to that same single day too — the
  // header filter and the Harian date input are the same shared state. This
  // stays pinned until the user resets it via the header's "Semua Tanggal".
  function handleHarianDateChange(dateStr: string) {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return;
    setPeriod({ year: y, month: m, day: d });
  }

  const queryClient = useQueryClient();
  const { handleError } = useApiError();
  const [showAddInv, setShowAddInv] = useState(false);
  const [editingInv, setEditingInv] = useState<InvestmentDto | null>(null);
  const [deletingInv, setDeletingInv] = useState<InvestmentDto | null>(null);
  const [invForm, setInvForm] = useState({
    ticker: "",
    name: "",
    type: "saham" as InvestmentType,
    quantity: "",
    costBasisPerUnit: "",
  });
  const [invSubmitting, setInvSubmitting] = useState(false);
  // null = follow the display currency until touched (add); edit opens on IDR (Decision 9/12).
  const [invCostCurrency, setInvCostCurrency] = useState<FxCurrencyCode | null>(
    null,
  );
  const invCostField = useControlledMoneyField({
    raw: invForm.costBasisPerUnit,
    currency: invCostCurrency,
    idrScale: 2,
    onChange: ({ raw, currency }) => {
      setInvForm((f) => ({ ...f, costBasisPerUnit: raw }));
      setInvCostCurrency(currency);
    },
  });

  function openAdd() {
    setInvForm({
      ticker: "",
      name: "",
      type: "saham",
      quantity: "",
      costBasisPerUnit: "",
    });
    setInvCostCurrency(null);
    setShowAddInv(true);
  }
  function openEdit(inv: InvestmentDto) {
    setInvForm({
      ticker: inv.ticker,
      name: inv.name,
      type: inv.type,
      quantity: inv.quantity,
      costBasisPerUnit: canonicalToTyping(inv.costBasisPerUnit, 2),
    });
    setInvCostCurrency("IDR");
    setEditingInv(inv);
  }

  async function handleInvSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (invCostField.resolved.isPending) {
      toast.error(t.money.rateNotReady);
      return;
    }
    setInvSubmitting(true);
    const isEdit = editingInv !== null;
    const url = isEdit
      ? `/family-groups/${familyGroupId}/investments/${editingInv.id}`
      : `/family-groups/${familyGroupId}/investments`;
    try {
      await apiFetch(url, {
        method: isEdit ? "PATCH" : "POST",
        token,
        body: JSON.stringify(
          withFxInputs(
            {
              ...invForm,
              costBasisPerUnit: moneyIdrDecimal(
                invCostField,
                () => toCanonicalAmount(invForm.costBasisPerUnit) ?? "0",
              ),
            },
            [["costBasisPerUnit", invCostField]],
          ),
        ),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investments.all(familyGroupId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investments.summary(familyGroupId),
      });
      toast.success(
        isEdit ? t.laporan.investasi.toastUpdated : t.investasi.toastAdded,
      );
      setShowAddInv(false);
      setEditingInv(null);
    } catch (err) {
      handleError(err);
    } finally {
      setInvSubmitting(false);
    }
  }

  async function handleInvDelete() {
    if (!deletingInv) return;
    setInvSubmitting(true);
    try {
      await apiFetch(
        `/family-groups/${familyGroupId}/investments/${deletingInv.id}`,
        {
          method: "DELETE",
          token,
        },
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investments.all(familyGroupId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investments.summary(familyGroupId),
      });
      toast.success(t.laporan.investasi.toastDeleted);
      setDeletingInv(null);
    } catch (err) {
      handleError(err);
    } finally {
      setInvSubmitting(false);
    }
  }

  const go = (id: string) =>
    router.push("/laporan?tab=" + id, { scroll: false });

  // EPIC-025 N3-J1 (gap 1) — the header's "Excel"/"PDF" buttons reuse this
  // SAME export job the detailed export card below the tabs uses, instead
  // of new controls that do nothing.
  const exportJob = useExportJob({
    familyGroupId,
    accessToken,
    startDate: rangeStart,
    endDate: rangeEnd,
  });

  const activeGroup = getReportGroupForTab(tab);
  const [findReport, setFindReport] = useState("");
  const findNeedle = findReport.trim().toLowerCase();
  const moneyFmt = useMoney();
  // Hero trend chart for the rsum tab (prototype's `rsum.viz`) — same
  // series the old "Pemasukan vs Pengeluaran" card below used, just moved
  // up into the dark cover alongside the legend chips.
  const heroActiveChartSummary = ringkasanChartSummary ?? summary;
  const heroChartMonths =
    heroActiveChartSummary?.points.map((p) => p.label) ?? [];
  const heroChartIncome =
    heroActiveChartSummary?.points.map((p) => p.income) ?? [];
  const heroChartExpense =
    heroActiveChartSummary?.points.map((p) => p.expense) ?? [];
  const heroChartAriaLabel =
    heroActiveChartSummary && heroChartMonths.length > 0
      ? `${t.laporan.ringkasan.cashflowCardTitle} ${heroChartMonths[heroChartMonths.length - 1]}: ${t.laporan.v2.income} ${moneyFmt.format(heroChartIncome[heroChartIncome.length - 1] ?? 0)}, ${t.laporan.v2.expense} ${moneyFmt.format(heroChartExpense[heroChartExpense.length - 1] ?? 0)}`
      : t.laporan.ringkasan.cashflowCardTitle;
  const cover = coverFor(
    tab as ReportTabId,
    {
      summary,
      yearly: yearlySummary,
      bank: bankReport,
      detail: detailReport,
      pnl,
      balance: balanceSheet,
      cashflow,
      invSummary,
      pph21,
      daily: dailyReport,
    },
    t,
    moneyFmt.format,
  );
  // The export type follows the report being viewed (the report picker is the
  // only report chooser); tabs without their own export type fall back to the
  // summary export.
  useEffect(() => {
    exportJob.setReportType(EXPORT_TYPE_FOR_TAB[tab] ?? "summary");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-sync only on tab change, not on every exportJob identity change.
  }, [tab]);
  const periodCaption =
    rangeStart && rangeEnd
      ? `${fmtDay(rangeStart, locale)} – ${fmtDay(rangeEnd, locale)}`
      : "";
  const visibleReportTabs = REPORT_TABS.filter((item) =>
    activeGroup.tabs.includes(item.id),
  );
  const groupTabIndex = visibleReportTabs.findIndex((item) => item.id === tab);
  function handleTabKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    const fwd = e.key === "ArrowRight" || e.key === "ArrowDown";
    const back = e.key === "ArrowLeft" || e.key === "ArrowUp";
    if (!fwd && !back) return;
    e.preventDefault();
    const delta = fwd ? 1 : -1;
    const next =
      visibleReportTabs[
        (groupTabIndex + delta + visibleReportTabs.length) %
          visibleReportTabs.length
      ];
    go(next.id);
    document.getElementById(`laporan-tab-${next.id}`)?.focus();
  }

  function renderSection() {
    switch (tab) {
      case "rharian":
        return (
          <HarianSection
            dailyReport={dailyReport}
            isLoading={isDailyLoading}
            date={harianDate}
            onDateChange={handleHarianDateChange}
          />
        );
      case "rbulanan":
        return (
          <BulananSection summary={summary} isLoading={isSummaryLoading} />
        );
      case "rtahunan":
        return (
          <TahunanSection yearly={yearlySummary} isLoading={isYearlyLoading} />
        );
      case "rfamily":
        return (
          <FamilySection
            members={familyMembers}
            netWorth={familyNetWorth}
            summary={summary}
            isLoading={isFamilyLoading || isNetWorthLoading || isSummaryLoading}
          />
        );
      case "rbank":
        return (
          <BankSection bankReport={bankReport} isLoading={isBankLoading} />
        );
      case "rdetail":
        return (
          <DetailSection
            detailReport={detailReport}
            isLoading={isDetailLoading}
          />
        );
      case "raliran":
        return (
          <AliranSection
            sankeyData={sankeyData}
            isLoading={isSankeyLoading}
            periodLabel={periodLabel}
          />
        );
      case "rpnl":
        return (
          <PnlSection
            pnl={pnl}
            isLoading={isPnlLoading}
            periodLabel={periodLabel}
          />
        );
      case "rbalance":
        return (
          <BalanceSection
            balanceSheet={balanceSheet}
            isLoading={isBalanceLoading}
            dashboardNetWorth={familyNetWorth}
            isDashboardNetWorthLoading={isNetWorthLoading}
            reconciliationBridge={reconciliationBridge}
            isBridgeLoading={isBridgeLoading}
          />
        );
      case "rcashflow":
        return (
          <CashflowSection
            cashflow={cashflow}
            isLoading={isCashflowLoading}
            periodLabel={periodLabel}
          />
        );
      case "rkas":
        return <KasSection summary={summary} isLoading={isSummaryLoading} />;
      case "rinv":
        return (
          <InvSection
            investments={investments}
            invSummary={invSummary}
            isLoading={isInvLoading}
            onAdd={openAdd}
            onEdit={openEdit}
            onDelete={setDeletingInv}
          />
        );
      case "rasl":
        return (
          <AslSection
            balanceSheet={balanceSheet}
            isLoading={isBalanceLoading}
          />
        );
      case "rperf":
        return (
          <PerfSection
            summary={summary}
            invSummary={invSummary}
            isLoading={isSummaryLoading}
          />
        );
      case "rpajak":
        return (
          <PajakSection
            pph21={pph21}
            grossIncome={annualGross ?? undefined}
            isLoading={isAnnualLoading || isPph21Loading}
          />
        );
      case "rcoa":
        return (
          <CoaSection
            coaAccounts={coaAccounts}
            coaAccountId={coaAccountId}
            onCoaAccountIdChange={setCoaAccountId}
            year={coaYear}
            onYearChange={setCoaYear}
            matrix={coaMatrix}
            isLoading={isCoaAccountsLoading || isCoaMatrixLoading}
          />
        );
      case "rsum":
      default:
        return (
          <RingkasanSection
            summary={summary}
            isLoading={isSummaryLoading || isDetailLoading}
            familyGroupId={familyGroupId}
            token={token}
            anchorEnd={summaryAnchorEnd}
          />
        );
    }
  }

  return (
    <div className="lp-page">
      {/* ONE Periode control at every width: the button shows the active range
          and opens the sheet holding Tahun / Bulan / Rentang (a bottom sheet on
          phones, a centred dialog on desktop). Replaces the old filter card. */}
      <div className="lp-period-m">
        <button
          type="button"
          className="lp-period-btn"
          aria-haspopup="dialog"
          onClick={openPeriodSheet}
        >
          <span className="lp-period-txt">
            {t.common.period}: <b>{periodLabel}</b>
          </span>
          <ChevronDown aria-hidden="true" />
        </button>
        {(tab === "rfamily" || tab === "rinv") && (
          <p className="t-xs lp-period-note">
            {t.laporan.periodFilter.periodNotApplicableNote}
          </p>
        )}
      </div>
      <Dialog open={periodSheetOpen} onOpenChange={setPeriodSheetOpen}>
        <DialogContent>
          <DialogTitle>{t.laporan.v2.filterTitle}</DialogTitle>
          <DialogDescription>{t.laporan.v2.filterCap}</DialogDescription>
          <DialogBody>
            <div className="lp-sheet-fields">
              <label className="field">
                <span className="label">
                  {t.laporan.periodFilter.yearAriaLabel}
                </span>
                <select
                  className="select"
                  value={draftYear}
                  onChange={(e) => {
                    setDraftYear(Number(e.target.value));
                    setDraftMode("month");
                  }}
                >
                  {filterYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">
                  {t.laporan.periodFilter.monthAriaLabel}
                </span>
                <select
                  className="select"
                  value={draftMonth}
                  onChange={(e) => {
                    setDraftMonth(Number(e.target.value));
                    setDraftMode("month");
                  }}
                >
                  {Array.from({ length: 12 }, (_, m) => (
                    <option key={m} value={m + 1}>
                      {new Date(2000, m, 1).toLocaleDateString(
                        locale === "en" ? "en-US" : "id-ID",
                        { month: "long" },
                      )}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">{t.laporan.v2.rangeLabel}</span>
                <RangePresetSelect
                  preset={draftPreset}
                  onChange={(next) => {
                    setDraftPreset(next);
                    setDraftMode("preset");
                  }}
                />
              </label>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={resetPeriodSheet}>
              {t.laporan.v2.resetPeriod}
            </Button>
            <Button onClick={applyPeriodSheet}>{t.common.apply}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phones: one picker instead of the index. */}
      <label className="lp-picker">
        <span className="wm-cap">
          {t.laporan.tabStrip.groups[activeGroup.id]}
        </span>
        <select
          value={tab}
          onChange={(e) => go(e.target.value)}
          aria-label={t.laporan.v2.reportsTitle}
        >
          {REPORT_GROUPS.map((group) => (
            <optgroup
              key={group.id}
              label={t.laporan.tabStrip.groups[group.id]}
            >
              {group.tabs.map((id) => (
                <option key={id} value={id}>
                  {t.shell.reportTabs[id]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <div className="lp-layout">
        <nav className="lp-idx" aria-label={t.laporan.v2.reportsTitle}>
          <div className="lp-idx-h">
            <h2>{t.laporan.v2.reportsTitle}</h2>
            <span className="wm-num">{REPORT_TABS.length}</span>
          </div>
          <label className="lp-find">
            <Search className="size-4 shrink-0" aria-hidden="true" />
            <input
              type="search"
              value={findReport}
              onChange={(e) => setFindReport(e.target.value)}
              placeholder={t.laporan.v2.findReport}
              aria-label={t.laporan.v2.findReport}
            />
          </label>
          <div
            role="tablist"
            aria-orientation="vertical"
            aria-label={t.laporan.tabStrip.ariaLabel}
          >
            {REPORT_GROUPS.map((group) => {
              const items = group.tabs.filter(
                (id) =>
                  !findNeedle ||
                  t.shell.reportTabs[id].toLowerCase().includes(findNeedle),
              );
              if (items.length === 0) return null;
              return (
                <div key={group.id} className="lp-grp" role="presentation">
                  <h3 role="presentation">
                    {t.laporan.tabStrip.groups[group.id]}
                  </h3>
                  {items.map((id) => {
                    const Icon = REPORT_ICONS[id];
                    const active = id === tab;
                    return (
                      <button
                        key={id}
                        id={`laporan-tab-${id}`}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        aria-controls="laporan-panel"
                        tabIndex={active ? 0 : -1}
                        className="lp-rep"
                        onClick={() => go(id)}
                        onKeyDown={handleTabKeyDown}
                      >
                        <i aria-hidden="true">
                          <Icon />
                        </i>
                        {t.shell.reportTabs[id]}
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {REPORT_GROUPS.every((g) =>
              g.tabs.every(
                (id) =>
                  findNeedle &&
                  !t.shell.reportTabs[id].toLowerCase().includes(findNeedle),
              ),
            ) && <p className="wm-cap px-2 py-4">{t.laporan.v2.noReport}</p>}
          </div>
        </nav>

        <div className="lp-main">
          <section className="wm-card wm-dark lp-cover">
            <div className="lp-c-top">
              <p className="lp-crumb">
                {t.laporan.tabStrip.groups[activeGroup.id]}{" "}
                <span aria-hidden="true">/</span>{" "}
                <b>
                  {t.shell.reportTabs[tab as ReportTabId] ??
                    t.laporan.header.title}
                </b>
                {periodCaption && (
                  <>
                    {" "}
                    <span aria-hidden="true">·</span> {periodCaption}
                  </>
                )}
              </p>
              <div className="lp-c-acts">
                {tab === "rharian" && (
                  <DateField
                    value={harianDate}
                    locale={locale}
                    label={t.laporan.harian.dateLabel}
                    required
                    onChange={handleHarianDateChange}
                  />
                )}
                <button
                  type="button"
                  className="lp-cbtn"
                  onClick={() => void exportJob.startExport("excel")}
                  disabled={!!exportJob.isActive || exportJob.isSubmitting}
                >
                  <Download aria-hidden="true" />{" "}
                  {t.laporan.header.exportExcelButton}
                </button>
                <button
                  type="button"
                  className="lp-cbtn"
                  data-lit="true"
                  onClick={() =>
                    window.open(
                      `/laporan/cetak?months=6&endDate=${wibDateOf(summaryAnchorEnd)}`,
                      "_blank",
                    )
                  }
                >
                  <Download aria-hidden="true" /> {t.laporan.v2.printPdf}
                </button>
              </div>
            </div>
            <p className="lp-headline">{cover.headline}</p>
            {/* Prototype parity (docs/design/proto/laporan.html `rsum.viz`)
                — the trend chart lives INSIDE the dark hero, above the
                legend chips, not in a separate card below it. The detailed
                "Export Laporan" card (report-type picker + PDF/CSV) was
                removed site-wide — the prototype's only export affordance
                anywhere on /laporan is these two header buttons, which
                already drive the same export job. */}
            {tab === "rsum" && heroChartMonths.length > 0 && (
              <div className="lp-chart-wrap">
                <div className="mb-2 flex justify-end">
                  <Segmented
                    label={t.laporan.ringkasan.cashflowCardTitle}
                    value={String(ringkasanChartRange)}
                    onChange={(v) =>
                      setRingkasanChartRange(Number(v) as 6 | 12)
                    }
                    options={[
                      { value: "6", label: t.laporan.ringkasan.cashflowRange6 },
                      {
                        value: "12",
                        label: t.laporan.ringkasan.cashflowRange12,
                      },
                    ]}
                  />
                </div>
                <div
                  className={
                    isRingkasanChartLoading
                      ? "lp-chart-wrap-chart opacity-50 pointer-events-none"
                      : "lp-chart-wrap-chart"
                  }
                >
                  <HatchedBarChart
                    labels={heroChartMonths}
                    series={[
                      {
                        name: t.laporan.v2.income,
                        data: heroChartIncome,
                        color: "var(--wm-lime)",
                      },
                      {
                        name: t.laporan.v2.expense,
                        data: heroChartExpense,
                        color: EXPENSE_COLOR,
                      },
                    ]}
                    format={moneyFmt.formatCompact}
                    formatFull={moneyFmt.format}
                    wide
                    ariaLabel={heroChartAriaLabel}
                  />
                </div>
              </div>
            )}
            {cover.legend.length > 0 && (
              <div className="lp-leg">
                {cover.legend.map((item) => (
                  <span key={item.label}>
                    <i style={{ background: item.color }} />
                    {item.label} <b>{item.value}</b>
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Active section */}
          <div
            id="laporan-panel"
            role="tabpanel"
            aria-labelledby={`laporan-tab-${tab}`}
          >
            {renderSection()}
          </div>
        </div>
      </div>
      <InvestmentDialogs
        showAddInv={showAddInv}
        editingInv={editingInv}
        deletingInv={deletingInv}
        invForm={invForm}
        costBasisField={invCostField}
        invSubmitting={invSubmitting}
        setShowAddInv={setShowAddInv}
        setEditingInv={setEditingInv}
        setDeletingInv={setDeletingInv}
        setInvForm={setInvForm}
        handleInvSubmit={handleInvSubmit}
        handleInvDelete={handleInvDelete}
      />
    </div>
  );
}
