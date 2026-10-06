"use client";

// EPIC-026 — prototype `ringkasan.html` block 5b: the "Pengeluaran terbesar"
// `.r-top` card (bento v2). `drawTopExpenses()` renders `#topExp` as an
// `.hbars` list — one row per category (name, amount, a thin red track bar
// sized off the top category's amount) — not an Apex hbar chart, which a
// previous pass used instead.

import { useRouter } from "next/navigation";

import { BentoCard, CardLink, Track } from "@/components/wm";
import { useLocale } from "@/hooks/use-locale";
import type { RingkasanData } from "./use-ringkasan-data";

export function TopExpensesCard({ data }: { data: RingkasanData }) {
  const { t } = useLocale();
  const router = useRouter();
  const { isLoading, topExpenseSlice, topExpenseAriaLabel, moneyFull } = data;

  const maxAmount = topExpenseSlice.reduce(
    (max, row) => Math.max(max, row.amount),
    0,
  );

  return (
    <BentoCard
      className="rk2-topexp"
      title={t.ringkasan.topExpensesTitle}
      action={
        <CardLink onClick={() => router.push("/laporan")}>
          {t.shell.pageTitles.laporan}
        </CardLink>
      }
    >
      <div
        className="stack private"
        style={{ gap: 10, marginTop: 12 }}
        aria-label={topExpenseAriaLabel}
      >
        {isLoading ? (
          <div className="h-[180px] animate-pulse rounded-md bg-muted" />
        ) : topExpenseSlice.length === 0 ? (
          <div className="py-4 text-center t-md t-muted">
            {t.ringkasan.emptyTopExpenses}
          </div>
        ) : (
          topExpenseSlice.map((row) => (
            <div key={row.categoryName}>
              <div className="row row--between">
                <span className="t-xs t-bold truncate">{row.categoryName}</span>
                <span className="t-xs t-muted mono shrink-0">
                  {moneyFull(row.amount)}
                </span>
              </div>
              <Track
                value={maxAmount > 0 ? (row.amount / maxAmount) * 100 : 0}
                fill="ink"
                className="mt-[5px]"
              />
            </div>
          ))
        )}
      </div>
    </BentoCard>
  );
}
