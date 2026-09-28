"use client";

// EPIC-026 — prototype `ringkasan.html` block 5a: the "Cash Flow <bulan>"
// card — a `.card__body.stack` of Pemasukan / Pengeluaran / Surplus, the last
// separated by a top border.
//
// The `CashflowChart` above the figures is an app-only addition kept from
// EPIC-025 N3-C2 (the prototype card has no chart); it plots the same
// `summary.cashflow` arrays the figures below are drawn from. Height stays at
// CASHFLOW_HEIGHT so the grouped bars keep real vertical range — an earlier
// bug pinned this to 90px and collapsed them.

import { CashflowChart } from "@/components/charts/apex-presets";
import { useLocale } from "@/hooks/use-locale";
import type { RingkasanData } from "./use-ringkasan-data";

const CASHFLOW_HEIGHT = 200;

export function CashflowCard({ data }: { data: RingkasanData }) {
  const { t } = useLocale();
  const {
    isLoading,
    moneyFull,
    monthIncome,
    monthExpense,
    monthNet,
    cashflowMonths,
    cashflowIncome,
    cashflowExpense,
    cashflowAriaLabel,
    money: moneyCompactFmt,
  } = data;

  return (
    <article className="card">
      <div className="card__header">
        <h2 className="card__title">
          {t.ringkasan.cashFlowTitlePrefix}
          {cashflowMonths.at(-1) ?? ""}
        </h2>
      </div>
      <div className="card__body stack" style={{ gap: 12 }}>
        {isLoading ? (
          <div
            className="animate-pulse rounded-md bg-muted"
            style={{ height: CASHFLOW_HEIGHT }}
          />
        ) : cashflowMonths.length === 0 ? null : (
          <div className="chart private">
            <CashflowChart
              months={cashflowMonths}
              income={cashflowIncome}
              expense={cashflowExpense}
              height={CASHFLOW_HEIGHT}
              ariaLabel={cashflowAriaLabel}
              money={{ format: moneyFull, formatCompact: moneyCompactFmt }}
            />
          </div>
        )}
        <div>
          <div className="t-xs t-muted">{t.ringkasan.incomeLabel}</div>
          <div className="t-xl t-black t-success mono private">
            {isLoading ? "..." : moneyFull(monthIncome)}
          </div>
        </div>
        <div>
          <div className="t-xs t-muted">{t.ringkasan.expenseLabel}</div>
          <div className="t-xl t-black t-danger mono private">
            {isLoading ? "..." : moneyFull(monthExpense)}
          </div>
        </div>
        <div
          style={{ paddingTop: 12, borderTop: "1px solid var(--border)" }}
          className="mt-auto"
        >
          <div className="t-xs t-muted">{t.ringkasan.surplusLabel}</div>
          <div
            className={`t-xl t-black mono private ${monthNet >= 0 ? "t-success" : "t-danger"}`}
          >
            {isLoading ? "..." : moneyFull(monthNet)}
          </div>
        </div>
      </div>
    </article>
  );
}
