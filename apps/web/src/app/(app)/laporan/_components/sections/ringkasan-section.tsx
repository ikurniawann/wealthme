import { useMemo } from "react";
import { BentoCard, MiniList, MiniRow } from "@/components/wm";
import { useMoney } from "@/hooks/use-money";
import { useLocale } from "@/hooks/use-locale";
import type { ReportSummaryDto } from "@wealthme/contracts";
import { likeForLikeWindow } from "@/lib/laporan-period";
import { EXPENSE_COLOR, INCOME_COLOR, vizByIndex } from "@/lib/viz-colors";
import { BarRow, ChgBadge } from "../atoms";
import { usePriorWindowTotals } from "@/hooks/use-prior-window-totals";
import "./sections-a.css";

/* ───────────────────────── Section: Ringkasan ───────────────────────── */

/**
 * Prototype parity (`docs/design/proto/laporan.html`'s `rsum` `body()`) —
 * the Ringkasan panel is exactly two cards: a ranked "Ke mana uangnya"
 * bar-row list and a "Dibanding bulan lalu" comparison list + change
 * badges. The headline stats, trend chart, and expense-allocation donut
 * all moved into (or already live in) the shared dark hero in
 * `laporan-inner.tsx`; the category table, wealth-allocation donut, and
 * investment-performance card were extraneous relative to the prototype
 * and are gone, not just relocated.
 */
export function RingkasanSection({
  summary,
  isLoading,
  familyGroupId,
  token,
  anchorEnd,
}: {
  summary?: ReportSummaryDto;
  isLoading?: boolean;
  familyGroupId: string;
  token: string | undefined;
  /** ISO end instant the summary is anchored on (the last point's month). */
  anchorEnd: string;
}) {
  const { t } = useLocale();
  const money = useMoney();
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";

  // Ranked bars take the shared brand palette by rank (the API's per-category
  // color is a free-form user hex that sits outside it).
  const rankedExpenses = summary
    ? [...summary.topExpenseCategories]
        .filter((item) => item.amount > 0)
        .sort((a, b) => b.amount - a.amount)
    : [];
  const maxExpenseAmount = rankedExpenses[0]?.amount ?? 0;

  const points = summary?.points ?? [];
  // The latest fetched month can be the current, still-empty one (no
  // transactions logged yet) — comparing it against the prior month would
  // print a misleading "Rp 0 vs Rp X, -100%" badge. Walk back to the most
  // recent month that actually has income or expense data, then compare it
  // with the month right before it.
  const latestWithDataIndex = (() => {
    for (let i = points.length - 1; i >= 0; i -= 1) {
      const p = points[i];
      if (p && (p.income > 0 || p.expense > 0)) return i;
    }
    return -1;
  })();
  const currentPoint =
    latestWithDataIndex >= 0 ? points[latestWithDataIndex] : undefined;
  const previousPoint =
    latestWithDataIndex > 0 ? points[latestWithDataIndex - 1] : undefined;
  // While the latest month is still running, compare it with the SAME
  // day-of-month window of the prior month (1–6 Okt vs 1–6 Sep), not a full
  // prior month. If that window is not available (loading / failed), say so
  // ("Sep penuh") and show no percentage rather than a misleading one.
  const nowRef = useMemo(() => new Date(), []);
  const likeWindow =
    currentPoint && previousPoint
      ? likeForLikeWindow({
          anchorEnd,
          pointCount: points.length,
          pointIndex: latestWithDataIndex,
          now: nowRef,
        })
      : null;
  const priorWindow = usePriorWindowTotals({
    familyGroupId,
    token,
    window: likeWindow,
  });
  const base = likeWindow ? priorWindow : previousPoint;
  const currentTag =
    currentPoint && likeWindow
      ? `1–${likeWindow.cutoffDay} ${currentPoint.label}`
      : currentPoint?.label;
  const previousTag = previousPoint
    ? likeWindow
      ? priorWindow
        ? `1–${likeWindow.priorCutoffDay} ${previousPoint.label}`
        : `${previousPoint.label} ${t.laporan.ringkasan.comparedFullMonthSuffix}`
      : previousPoint.label
    : undefined;
  // Direction is the arrow; valence is colour + sr-only text (lib/delta.ts):
  // spending that fell is a ↓ in the good colour.
  const compareRows = [
    {
      key: "income",
      title: t.laporan.v2.income,
      color: INCOME_COLOR,
      polarity: "higher-better",
    },
    {
      key: "expense",
      title: t.laporan.v2.expense,
      color: EXPENSE_COLOR,
      polarity: "lower-better",
    },
    {
      key: "net",
      title: t.laporan.v2.saved,
      color: "var(--primary)",
      polarity: "higher-better",
    },
  ] as const;

  return (
    <div className={"grid grid-cols-1 gap-3.5 lg:grid-cols-12 " + loadingClass}>
      <div className="lg:col-span-7">
        <BentoCard title={t.laporan.ringkasan.whereMoneyGoesTitle}>
          {rankedExpenses.length > 0 ? (
            <div className="flex flex-col gap-1">
              {rankedExpenses.map((item, index) => (
                <BarRow
                  key={item.categoryName}
                  label={item.categoryName}
                  right={money.format(item.amount)}
                  value={
                    maxExpenseAmount > 0
                      ? Math.round((item.amount / maxExpenseAmount) * 100)
                      : 0
                  }
                  color={vizByIndex(index)}
                />
              ))}
            </div>
          ) : (
            <div className="lap-a-empty">
              <b>{t.laporan.ringkasan.categoryTable.emptyState}</b>
            </div>
          )}
        </BentoCard>
      </div>
      <div className="lg:col-span-5">
        <BentoCard title={t.laporan.ringkasan.comparedLastMonthTitle}>
          {currentPoint && previousPoint ? (
            <>
              <p className="lap-a-cmp-note">
                {currentTag} {t.laporan.ringkasan.statVsPrefix} {previousTag}
              </p>
              <MiniList
                className="lap-a-cmp"
                label={t.laporan.ringkasan.comparedLastMonthTitle}
              >
                {compareRows.map((row) => (
                  <MiniRow
                    key={row.key}
                    icon={
                      <span
                        className="size-2.5 rounded-full"
                        style={{ background: row.color }}
                        aria-hidden="true"
                      />
                    }
                    title={row.title}
                    meta={
                      <>
                        {previousTag}:{" "}
                        <span className="wm-amt">
                          {money.format(
                            (priorWindow && likeWindow
                              ? priorWindow
                              : previousPoint)[row.key],
                          )}
                        </span>
                      </>
                    }
                    amount={
                      <span className="lap-a-cmp-amt">
                        <span>{money.format(currentPoint[row.key])}</span>
                        {base && (
                          <ChgBadge
                            previous={base[row.key]}
                            current={currentPoint[row.key]}
                            polarity={row.polarity}
                          />
                        )}
                      </span>
                    }
                  />
                ))}
              </MiniList>
            </>
          ) : (
            <div className="lap-a-empty">
              <b>{t.laporan.ringkasan.categoryTable.emptyState}</b>
              <span>{t.laporan.ringkasan.comparedLastMonthEmptyHint}</span>
            </div>
          )}
        </BentoCard>
      </div>
    </div>
  );
}
