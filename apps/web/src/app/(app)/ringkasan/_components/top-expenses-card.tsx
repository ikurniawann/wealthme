"use client";

// EPIC-026 — prototype `ringkasan.html` block 5b: the "Top Pengeluaran" card,
// whose `#c-topexp` mount is an hbar chart (`WMCharts.hbar(..., cssVar(
// "--destructive"))`) with a "Laporan" card link — not a hand-rolled list.
// The chart's own height is `max(180, n * 38)` inside `HBarChart`, matching
// the prototype preset.

import { useRouter } from "next/navigation";

import { CardLink } from "@/components/wm";
import { HBarChart } from "@/components/charts/apex-presets";
import { useLocale } from "@/hooks/use-locale";
import type { RingkasanData } from "./use-ringkasan-data";

export function TopExpensesCard({ data }: { data: RingkasanData }) {
  const { t } = useLocale();
  const router = useRouter();
  const {
    isLoading,
    topExpenseSlice,
    topExpenseCategories,
    topExpenseData,
    topExpenseAriaLabel,
  } = data;

  return (
    <article className="card">
      <div className="card__header">
        <h2 className="card__title">{t.ringkasan.topExpensesTitle}</h2>
        <div className="card__action">
          <CardLink onClick={() => router.push("/laporan")}>
            {t.shell.pageTitles.laporan}
          </CardLink>
        </div>
      </div>
      <div className="card__body">
        {isLoading ? (
          <div className="h-[180px] animate-pulse rounded-md bg-muted" />
        ) : topExpenseSlice.length === 0 ? (
          <div className="py-4 text-center t-md t-muted">
            {t.ringkasan.emptyTopExpenses}
          </div>
        ) : (
          <div className="chart private">
            {/* Prototype colours this series `--destructive` at the call
                site — kept, since "top expenses" reads as spend, not brand. */}
            <HBarChart
              categories={topExpenseCategories}
              data={topExpenseData}
              color="var(--destructive)"
              ariaLabel={topExpenseAriaLabel}
            />
          </div>
        )}
      </div>
    </article>
  );
}
