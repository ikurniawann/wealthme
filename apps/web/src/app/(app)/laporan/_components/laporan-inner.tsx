"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-compat";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useLocale } from "@/hooks/use-locale";
import { useApiError } from "@/hooks/use-api-error";
import { REPORT_TABS } from "@/lib/nav";
import {
  getPeriodDateRange,
  getYearDateRange,
  REPORT_TIMEZONE_LABEL,
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
import { InfoTip } from "@/components/wm";
import type {
  FxCurrencyCode,
  InvestmentDto,
  InvestmentType,
} from "@wealthme/contracts";
import { useExportJob, ExportSection } from "./export-section";
import { useLaporanReportQueries } from "./use-laporan-report-queries";
import { InvestmentDialogs } from "./investment-dialogs";
import { RangePresetSelect } from "./period-filter";
import {
  DateRangeFilterField,
  formatDateRangeLabel,
} from "@/components/wm/date-range-field";
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
    useState<ReportRangePreset>("thisMonth");
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

  // EPIC-025 N3-J1 (gap 4) — pill tab strip with scroll arrows.
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  function scrollReportTabs(direction: number) {
    const el = tabsScrollRef.current;
    if (!el) return;
    const amount = Math.max(280, Math.round(el.clientWidth * 0.72));
    el.scrollBy({ left: direction * amount, behavior: "smooth" });
  }
  const activeGroup = getReportGroupForTab(tab);
  const visibleReportTabs = REPORT_TABS.filter((item) =>
    activeGroup.tabs.includes(item.id),
  );
  const groupTabIndex = visibleReportTabs.findIndex((item) => item.id === tab);
  function handleTabKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const delta = e.key === "ArrowRight" ? 1 : -1;
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
            grossIncome={annualGross}
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
            go={go}
            summary={summary}
            detailReport={detailReport}
            invSummary={invSummary}
            balanceSheet={balanceSheet}
            isLoading={isSummaryLoading || isDetailLoading}
            chartSummary={ringkasanChartSummary}
            isChartLoading={isRingkasanChartLoading}
            chartRange={ringkasanChartRange}
            onChartRangeChange={setRingkasanChartRange}
            periodLabel={periodLabel}
          />
        );
    }
  }

  return (
    <div className="space-y-4">
      {/* Page lead — prototype's `.page-lead` (gap 1): H1 + subtitle with an
          accent underline, and header export buttons that trigger the SAME
          real job as the detailed export card below the tabs (`exportJob`,
          shared with `ExportSection`) — never a second, dead control. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="border-l-4 border-primary pl-3 text-[20px] font-extrabold tracking-tight sm:text-[22px]">
            {t.laporan.header.title}
          </h1>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => void exportJob.startExport("excel")}
            disabled={!!exportJob.isActive || exportJob.isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3.5 py-[8px] text-[12px] font-semibold transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileSpreadsheet className="size-3.5" />
            {t.laporan.header.exportExcelButton}
          </button>
          <button
            type="button"
            onClick={() => void exportJob.startExport("pdf")}
            disabled={!!exportJob.isActive || exportJob.isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3.5 py-[8px] text-[12px] font-semibold transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileText className="size-3.5" />
            {t.laporan.header.exportPdfButton}
          </button>
        </div>
      </div>

      {/* Filter Laporan card (gap 2) — wraps the existing preset/period
          selectors; logic is unchanged, only the presentation moved into a
          proper card matching the prototype. */}
      {/* Filter Laporan — prototype `section.card.report-filter-card`
          (docs/prototype/pages/laporan.html): `.card__header` with title +
          "Berlaku untuk semua tab" action, then a `.bento-filter` holding
          exactly TWO fields — the Periode preset select and an always-visible
          date-range picker. The app previously rendered a bespoke Tailwind box
          whose second field was three year/month/day selects that only
          appeared once "Custom" was chosen, i.e. four controls instead of two. */}
      <section className="card report-filter-card">
        <div className="card__header">
          <h2 className="card__title">{t.laporan.filterCard.title}</h2>
          <span className="card__action t-xs t-muted">
            {t.laporan.filterCard.appliesAllTabsCaption}
          </span>
        </div>
        <div className="card__body" style={{ paddingTop: 16 }}>
          <div className="bento-filter">
            <div className="field" style={{ minWidth: 210 }}>
              <span className="label">{t.laporan.filterCard.periodeLabel}</span>
              <RangePresetSelect
                preset={rangePreset}
                onChange={setRangePreset}
              />
            </div>
            <DateRangeFilterField
              label={t.laporan.filterCard.dateRangeLabel}
              /* wibDateOf, never `.slice(0,10)`: these bounds are WIB-pinned,
                 so slicing the ISO instant would show the previous UTC day
                 (1 Aug 00:00 WIB is 31 Jul 17:00 UTC). */
              from={wibDateOf(rangeStart)}
              to={wibDateOf(rangeEnd)}
              locale={locale}
              cancelLabel={t.common.cancel}
              applyLabel={t.common.save}
              onApply={(from, to) => {
                setCustomRange({ from, to });
                setRangePreset("custom");
              }}
            />
            <div className="bento-filter__actions" />
          </div>

          {/* EPIC-022 B7 — report boundaries are pinned to WIB (never the
              viewer's local offset); disclose the pin instead of leaving it
              silent. Not in the prototype, deliberately kept. */}
          <div className="t-xs t-muted" style={{ marginTop: 8 }}>
            {t.laporan.periodFilter.timezoneNotePrefix}
            {REPORT_TIMEZONE_LABEL}
            {t.laporan.periodFilter.timezoneNoteSuffix}
          </div>

          {/* EPIC-023 Task B retry (HIGH) — rfamily (roster + net worth) and
              rinv (current holdings) have no period semantics to filter by;
              say so plainly instead of implying the selector does something. */}
          {(tab === "rfamily" || tab === "rinv") && (
            <div
              className="t-xs"
              style={{ marginTop: 4, color: "var(--warning)" }}
            >
              {t.laporan.periodFilter.periodNotApplicableNote}
            </div>
          )}

          {/* Cash-basis disclosure callout (gap 3) — active period rendered
            from the real `periodLabel` derivation above, not a static
            string. Polish batch 8 item 10 — the full explanation ran 4
            lines at 390px; keep one line (title + active period) and move
            the "why" into the InfoTip popover instead. */}
          <div
            className="notice notice--info items-center"
            style={{ marginTop: 14 }}
          >
            <Info className="size-4 shrink-0" />
            <span className="flex-1">
              <strong>{t.laporan.cashBasisNotice.title}</strong>{" "}
              {t.laporan.cashBasisNotice.activePeriodPrefix}{" "}
              <span className="mono">{periodLabel}</span>.
            </span>
            <InfoTip label={t.laporan.cashBasisNotice.title}>
              {t.laporan.cashBasisNotice.body}
            </InfoTip>
          </div>
        </div>
      </section>

      {/* Report categories keep all 17 destinations discoverable without
          placing every report in one horizontal strip. */}
      <div className="space-y-2">
        <div
          role="group"
          aria-label={t.laporan.tabStrip.groupAriaLabel}
          className="grid grid-cols-2 gap-1.5 sm:grid-cols-5"
        >
          {REPORT_GROUPS.map((group) => {
            const active = activeGroup.id === group.id;
            return (
              <button
                key={group.id}
                type="button"
                aria-pressed={active}
                onClick={() => go(group.tabs[0])}
                className={
                  "min-h-11 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors " +
                  (active
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:bg-accent")
                }
              >
                {t.laporan.tabStrip.groups[group.id]}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scrollReportTabs(-1)}
            aria-label={t.laporan.tabStrip.scrollLeftAriaLabel}
            className="size-11 shrink-0 rounded-full border bg-card p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div
            ref={tabsScrollRef}
            role="tablist"
            aria-label={t.laporan.tabStrip.ariaLabel}
            className="hide-scrollbar flex flex-1 gap-1.5 overflow-x-auto scroll-smooth"
          >
            {visibleReportTabs.map((tabItem) => {
              const active = tabItem.id === tab;
              return (
                <button
                  key={tabItem.id}
                  id={`laporan-tab-${tabItem.id}`}
                  role="tab"
                  aria-selected={active}
                  aria-controls="laporan-panel"
                  tabIndex={active ? 0 : -1}
                  onClick={() => go(tabItem.id)}
                  onKeyDown={handleTabKeyDown}
                  className={
                    "min-h-11 shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap transition-colors " +
                    (active
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:bg-accent")
                  }
                >
                  {t.shell.reportTabs[tabItem.id]}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => scrollReportTabs(1)}
            aria-label={t.laporan.tabStrip.scrollRightAriaLabel}
            className="size-11 shrink-0 rounded-full border bg-card p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
          <span className="mono shrink-0 text-[11px] text-muted-foreground">
            {groupTabIndex + 1}/{visibleReportTabs.length}
          </span>
        </div>
      </div>

      {/* Export (detailed card — report type, status, download) */}
      {familyGroupId && <ExportSection exportJob={exportJob} />}

      {/* Active section */}
      <div
        id="laporan-panel"
        role="tabpanel"
        aria-labelledby={`laporan-tab-${tab}`}
      >
        {renderSection()}
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
