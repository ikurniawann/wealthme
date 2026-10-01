import { BentoCard, MiniList, MiniRow } from "@/components/wm";
import { useMoney } from "@/hooks/use-money";
import { useLocale } from "@/hooks/use-locale";
import type { ReportSummaryDto } from "@wealthme/contracts";
import { categoryBreakdownToDonut } from "@/lib/laporan-utils";
import { BarRow, ChgBadge } from "../atoms";
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
}: {
  summary?: ReportSummaryDto;
  isLoading?: boolean;
}) {
  const { t } = useLocale();
  const money = useMoney();
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";

  // Same segments/colors `expenseDonut` used to feed the (now-removed)
  // donut card — reused here only for a stable color per category name.
  const expenseDonut = summary
    ? categoryBreakdownToDonut(summary.topExpenseCategories)
    : [];
  const colorByCategory = new Map(
    expenseDonut.map((seg) => [seg.label, seg.color]),
  );
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
  const incomeDeltaPct =
    currentPoint && previousPoint && previousPoint.income > 0
      ? ((currentPoint.income - previousPoint.income) / previousPoint.income) *
        100
      : null;
  const expenseDeltaPct =
    currentPoint && previousPoint && previousPoint.expense > 0
      ? ((currentPoint.expense - previousPoint.expense) /
          previousPoint.expense) *
        100
      : null;
  const savingsDeltaPct =
    currentPoint && previousPoint && previousPoint.net !== 0
      ? ((currentPoint.net - previousPoint.net) / Math.abs(previousPoint.net)) *
        100
      : null;

  return (
    <div className={"grid grid-cols-1 gap-3.5 lg:grid-cols-12 " + loadingClass}>
      <div className="lg:col-span-7">
        <BentoCard title={t.laporan.ringkasan.whereMoneyGoesTitle}>
          {rankedExpenses.length > 0 ? (
            <div className="flex flex-col gap-1">
              {rankedExpenses.map((item) => (
                <BarRow
                  key={item.categoryName}
                  label={item.categoryName}
                  right={money.formatCompact(item.amount)}
                  value={
                    maxExpenseAmount > 0
                      ? Math.round((item.amount / maxExpenseAmount) * 100)
                      : 0
                  }
                  color={
                    colorByCategory.get(item.categoryName) ?? "var(--primary)"
                  }
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
              <p className="mb-1 text-[11px] text-muted-foreground">
                {currentPoint.label} {t.laporan.ringkasan.statVsPrefix}{" "}
                {previousPoint.label}
              </p>
              <MiniList label={t.laporan.ringkasan.comparedLastMonthTitle}>
                <MiniRow
                  icon={
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: "var(--wm-lime)" }}
                      aria-hidden="true"
                    />
                  }
                  title={t.laporan.v2.income}
                  meta={`${previousPoint.label}: ${money.format(previousPoint.income)}`}
                  amount={money.format(currentPoint.income)}
                />
                <MiniRow
                  icon={
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: "var(--wm-orange)" }}
                      aria-hidden="true"
                    />
                  }
                  title={t.laporan.v2.expense}
                  meta={`${previousPoint.label}: ${money.format(previousPoint.expense)}`}
                  amount={money.format(currentPoint.expense)}
                />
                <MiniRow
                  icon={
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: "var(--primary)" }}
                      aria-hidden="true"
                    />
                  }
                  title={t.laporan.v2.saved}
                  meta={`${previousPoint.label}: ${money.format(previousPoint.net)}`}
                  amount={money.format(currentPoint.net)}
                />
              </MiniList>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {incomeDeltaPct !== null && <ChgBadge pct={incomeDeltaPct} />}
                {expenseDeltaPct !== null && (
                  <ChgBadge pct={-expenseDeltaPct} />
                )}
                {savingsDeltaPct !== null && <ChgBadge pct={savingsDeltaPct} />}
              </div>
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
