"use client";

import { BentoCard } from "@/components/wm";
import { HatchedBarChart } from "@/components/charts/bento-charts";
import { useLocale } from "@/hooks/use-locale";
import type { RingkasanData } from "./use-ringkasan-data";

const MONTHS_SHOWN = 6;

export function CashflowCard({ data }: { data: RingkasanData }) {
  const { t } = useLocale();
  const {
    isLoading,
    moneyFull,
    money,
    cashflowMonths,
    cashflowIncome,
    cashflowExpense,
    cashflowAriaLabel,
  } = data;

  const months = cashflowMonths.slice(-MONTHS_SHOWN);
  const income = cashflowIncome.slice(-MONTHS_SHOWN);
  const expense = cashflowExpense.slice(-MONTHS_SHOWN);

  // The current month is often still empty; summarise the latest month that
  // has activity so the figures match a visible pair of bars.
  let refIndex = months.length - 1;
  while (refIndex > 0 && !income[refIndex] && !expense[refIndex]) refIndex--;
  const refIncome = income[refIndex] ?? 0;
  const refExpense = expense[refIndex] ?? 0;
  const refNet = refIncome - refExpense;
  const refMonth = months[refIndex] ?? "";
  const avgNet =
    months.length > 0
      ? income.reduce((sum, v, i) => sum + v - (expense[i] ?? 0), 0) /
        months.length
      : 0;

  return (
    <BentoCard
      className="rk2-cash"
      title={`${t.ringkasan.cashFlowTitlePrefix}${refMonth}`}
      caption={months.length > 0 ? `${months[0]} – ${months.at(-1)}` : ""}
      action={
        <div className="wm-legend">
          <span>
            <i style={{ background: "var(--wm-lime)" }} />
            {t.ringkasan.incomeLabel}
          </span>
          <span>
            <i style={{ background: "var(--wm-orange)" }} />
            {t.ringkasan.expenseLabel}
          </span>
        </div>
      }
    >
      {isLoading ? (
        <div className="mt-4 h-[210px] animate-pulse rounded-xl bg-muted" />
      ) : months.length === 0 ? null : (
        <>
          <div className="rk2-cash-chart private">
            <HatchedBarChart
              labels={months}
              series={[
                {
                  name: t.ringkasan.incomeLabel,
                  data: income,
                  color: "var(--wm-lime)",
                },
                {
                  name: t.ringkasan.expenseLabel,
                  data: expense,
                  color: "var(--wm-orange)",
                },
              ]}
              highlight={refIndex}
              format={money}
              axis={money}
              ariaLabel={cashflowAriaLabel}
            />
          </div>
          <dl className="rk2-cash-stats private">
            <div>
              <dt>{t.ringkasan.incomeLabel}</dt>
              <dd className="t-success">{moneyFull(refIncome)}</dd>
            </div>
            <div>
              <dt>{t.ringkasan.expenseLabel}</dt>
              <dd className="t-danger">{moneyFull(refExpense)}</dd>
            </div>
            <div>
              <dt>{t.ringkasan.surplusLabel}</dt>
              <dd className={refNet >= 0 ? "t-success" : "t-danger"}>
                {moneyFull(refNet)}
              </dd>
            </div>
            <div>
              <dt>{t.ringkasan.avgNetPerMonthLabel}</dt>
              <dd className={avgNet >= 0 ? "" : "t-danger"}>{money(avgNet)}</dd>
            </div>
          </dl>
        </>
      )}
    </BentoCard>
  );
}
