"use client";

import { ArrowUpRight, ChevronDown, Share } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { DetailReportDto, PnlDto } from "@wealthme/contracts";
import { useSession } from "@/lib/auth-compat";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { getPeriodDateRange } from "@/lib/laporan-period";
import { localIsoDate } from "@/lib/local-date";
import { useLocale } from "@/hooks/use-locale";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useMoney } from "@/hooks/use-money";
import "./mobile-summary.css";

const COPY = {
  id: {
    month: "Bulan",
    share: "Bagikan atau cetak laporan {month}",
    expense: "Pengeluaran",
    count: "{n} transaksi",
    split: "Pembagian pengeluaran per kategori",
    other: "Lainnya",
    uncategorized: "Tanpa kategori",
    empty: "Belum ada pengeluaran di bulan ini.",
    loading: "Memuat…",
    error: "Ringkasan bulan ini gagal dimuat.",
    openFull: "Lihat laporan lengkap",
    closeFull: "Tutup laporan lengkap",
  },
  en: {
    month: "Month",
    share: "Share or print the {month} report",
    expense: "Spending",
    count: "{n} transactions",
    split: "Spending split by category",
    other: "Other",
    uncategorized: "Uncategorized",
    empty: "No spending this month yet.",
    loading: "Loading…",
    error: "This month's summary failed to load.",
    openFull: "See full report",
    closeFull: "Close full report",
  },
} as const;

const MONTHS_BACK = 12;
/** Categories drawn before the rest folds into "Lainnya". */
const MAX_SLICES = 4;
/** Darkest shade: this much --wm-lime-ink mixed into --wm-lime. */
const DARKEST_MIX = 55;

export type Slice = { label: string; amount: number; shade: string };

/** Largest categories first, the tail folded into one "other" slice. */
export function expenseSlices(
  breakdown: readonly { categoryName: string; amount: number }[],
  labels: { other: string; uncategorized: string },
): Slice[] {
  const sorted = breakdown
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const head = sorted.slice(0, MAX_SLICES);
  const rest = sorted.slice(MAX_SLICES).reduce((sum, i) => sum + i.amount, 0);
  const items = head.map((item) => ({
    label: item.categoryName || labels.uncategorized,
    amount: item.amount,
  }));
  if (rest > 0) items.push({ label: labels.other, amount: rest });
  return items.map((item, index) => {
    const mix =
      items.length > 1
        ? Math.round(DARKEST_MIX * (1 - index / (items.length - 1)))
        : 0;
    return {
      ...item,
      shade: `color-mix(in oklab, var(--wm-lime-ink) ${mix}%, var(--wm-lime))`,
    };
  });
}

/**
 * Phone-only Laporan summary (<= 720px), per docs/design/refs/2026-10-20:
 * month pill + share, the month's spending with its transaction count, one
 * stacked bar of the category split in lime shades and its legend, then a
 * button that reveals the full report below. Totals and split come from the
 * P&L report (same as the desktop figures), the count from the detail report.
 */
export function LaporanMobileSummary({
  month,
  onMonth,
  fullOpen,
  onToggleFull,
}: {
  /** "YYYY-MM" */
  month: string;
  onMonth: (month: string) => void;
  fullOpen: boolean;
  onToggleFull: () => void;
}) {
  const { locale } = useLocale();
  const c = locale === "en" ? COPY.en : COPY.id;
  const money = useMoney();
  const { data: session } = useSession();
  const familyGroupId = session?.familyGroupId ?? "";
  const token = session?.accessToken;
  const isPhone = useMediaQuery("(max-width: 720px)");
  const enabled = isPhone && Boolean(familyGroupId) && Boolean(token);

  const [year, monthNo] = month.split("-").map(Number);
  const { startDate, endDate } = getPeriodDateRange({
    year,
    month: monthNo,
    day: null,
  });
  const pnl = useQuery<PnlDto>({
    queryKey: queryKeys.reports.pnl(familyGroupId, startDate, endDate),
    queryFn: () =>
      apiFetch<PnlDto>(
        `/family-groups/${familyGroupId}/reports/pnl?startDate=${startDate}&endDate=${endDate}`,
        { token },
      ),
    enabled,
    staleTime: 60_000,
  });
  const detail = useQuery<DetailReportDto>({
    queryKey: queryKeys.reports.detail(familyGroupId, startDate, endDate),
    queryFn: () =>
      apiFetch<DetailReportDto>(
        `/family-groups/${familyGroupId}/reports/detail?startDate=${startDate}&endDate=${endDate}`,
        { token },
      ),
    enabled,
    staleTime: 60_000,
  });

  const dateLocale = locale === "en" ? "en-US" : "id-ID";
  const monthLabel = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(dateLocale, {
      month: "long",
      year: "numeric",
    });
  };
  const today = localIsoDate();
  const currentKey = today.slice(0, 7);
  const options = Array.from({ length: MONTHS_BACK }, (_, back) => {
    const [y, m] = currentKey.split("-").map(Number);
    const date = new Date(y, m - 1 - back, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
  const lastDay = new Date(year, monthNo, 0).getDate();
  const printEnd =
    month === currentKey
      ? today
      : `${month}-${String(lastDay).padStart(2, "0")}`;

  const total = pnl.data?.expenses ?? 0;
  const slices = expenseSlices(pnl.data?.expenseBreakdown ?? [], c);
  const sliceSum = slices.reduce((sum, s) => sum + s.amount, 0);
  const count = detail.data
    ? detail.data.transactions.filter((tx) => tx.type === "expense").length
    : null;
  const isLoading = pnl.isLoading;

  return (
    <section className="lpm" aria-label={c.expense}>
      <div className="lpm-top">
        <label className="lpm-pill">
          <span className="sr-only">{c.month}</span>
          <select value={month} onChange={(e) => onMonth(e.target.value)}>
            {options.map((value) => (
              <option key={value} value={value}>
                {monthLabel(value)}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" />
        </label>
        <a
          className="lpm-icon"
          href={`/laporan/cetak?months=1&endDate=${printEnd}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={c.share.replace("{month}", monthLabel(month))}
        >
          <Share aria-hidden="true" />
        </a>
      </div>

      <div className="lpm-total">
        <h2>{c.expense}</h2>
        <p className="lpm-value wm-num">
          {isLoading ? "…" : pnl.isError ? "—" : money.format(total)}
        </p>
        {count !== null && (
          <p className="lpm-count">{c.count.replace("{n}", String(count))}</p>
        )}
      </div>

      {pnl.isError ? (
        <p className="wm-cap lpm-note">{c.error}</p>
      ) : isLoading ? (
        <p className="wm-cap lpm-note">{c.loading}</p>
      ) : slices.length === 0 ? (
        <p className="wm-cap lpm-note">{c.empty}</p>
      ) : (
        <>
          <div
            className="lpm-bar"
            role="img"
            aria-label={`${c.split}: ${slices
              .map((s) => `${s.label} ${money.format(s.amount)}`)
              .join(", ")}`}
          >
            {slices.map((slice) => (
              <span
                key={slice.label}
                style={{
                  flexGrow: slice.amount / Math.max(1, sliceSum),
                  background: slice.shade,
                }}
              />
            ))}
          </div>
          <ul className="lpm-legend">
            {slices.map((slice) => (
              <li key={slice.label}>
                <i style={{ background: slice.shade }} aria-hidden="true" />
                <span>{slice.label}</span>
                <b className="wm-num">{money.format(slice.amount)}</b>
              </li>
            ))}
          </ul>
        </>
      )}

      <button
        type="button"
        className="lpm-full-btn"
        aria-expanded={fullOpen}
        aria-controls="laporan-full"
        onClick={onToggleFull}
      >
        {fullOpen ? c.closeFull : c.openFull}
        <ArrowUpRight aria-hidden="true" />
      </button>
    </section>
  );
}
