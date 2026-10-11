"use client";

import type { ReactNode } from "react";
import type {
  BalanceSheetDto,
  BankReportDto,
  CashflowStatementDto,
  DetailReportDto,
  InvestmentSummaryDto,
  PnlDto,
  Pph21ResultDto,
  ReportSummaryDto,
} from "@wealthme/contracts";
import { EXPENSE_COLOR } from "@/lib/viz-colors";
import type { ReportTabId } from "@/lib/nav";
import type { I18nDictionary } from "@/i18n/types";

export type CoverData = {
  summary?: ReportSummaryDto;
  yearly?: ReportSummaryDto;
  bank?: BankReportDto;
  detail?: DetailReportDto;
  pnl?: PnlDto;
  balance?: BalanceSheetDto;
  cashflow?: CashflowStatementDto;
  invSummary?: InvestmentSummaryDto;
  pph21?: Pph21ResultDto;
  /** Today's report (rharian tab) — a separate fetch from `detail` (rdetail's
   * period-wide report), already loaded by `laporan-inner` for the Harian
   * section. */
  daily?: DetailReportDto;
};

type Legend = { label: string; value: string; color: string };
type Cover = { headline: ReactNode; legend: Legend[] };

const LIME = "var(--wm-lime)";
/** Expense on the hero's bar chart: same tone on every page. */
const EXPENSE = EXPENSE_COLOR;
const INK = "#eef0e8";
const MUTED = "rgb(238 240 232 / 0.62)";

/** Put `em` (lime) around the `{amount}` part of a headline template. */
function fill(template: string, parts: Record<string, string>, em: string) {
  const [before, after] = template.split(`{${em}}`);
  const sub = (s: string) =>
    Object.entries(parts).reduce(
      (acc, [k, v]) => acc.replaceAll(`{${k}}`, v),
      s,
    );
  if (after === undefined) return sub(template);
  return (
    <>
      {sub(before)}
      <em>{parts[em]}</em>
      {sub(after)}
    </>
  );
}

/**
 * Bento v2 report cover (docs/design/proto/laporan.html `.cover`): one
 * headline sentence built from the report's own real figures, plus a legend
 * row. Falls back to the report's name when its data is not loaded yet;
 * never invents a number.
 */
export function coverFor(
  tab: ReportTabId,
  d: CoverData,
  t: I18nDictionary,
  money: (n: number) => string,
): Cover {
  const v = t.laporan.v2;
  const name = t.shell.reportTabs[tab];
  const flow = (s: ReportSummaryDto | undefined): Cover | null => {
    if (!s) return null;
    const legend = [
      { label: v.income, value: money(s.totalIncome ?? 0), color: LIME },
      { label: v.expense, value: money(s.totalExpense ?? 0), color: EXPENSE },
      { label: v.saved, value: money(s.netSavings ?? 0), color: INK },
    ];
    if ((s.netSavings ?? 0) < 0)
      return {
        headline: fill(
          v.hDeficit,
          { amount: money(Math.abs(s.netSavings ?? 0)) },
          "amount",
        ),
        legend,
      };
    return {
      headline: fill(
        v.hSaved,
        {
          amount: money(s.netSavings ?? 0),
          pct: String(Math.round(s.savingsRate ?? 0)),
        },
        "amount",
      ),
      legend,
    };
  };
  let cover: Cover | null = null;
  switch (tab) {
    case "rsum":
      cover = flow(d.summary);
      break;
    case "rbulanan": {
      // This tab shows ONE month (the selected/latest point in the trend
      // window), not the whole multi-month window `flow()` summarizes — use
      // the last point so the headline matches the recap table below it.
      const points = d.summary?.points ?? [];
      const p = points[points.length - 1];
      if (p) {
        const legend = [
          { label: v.income, value: money(p.income), color: LIME },
          { label: v.expense, value: money(p.expense), color: EXPENSE },
          { label: v.saved, value: money(p.net), color: INK },
        ];
        cover = {
          headline:
            p.net < 0
              ? fill(
                  v.hBulanDeficit,
                  { month: p.label, amount: money(Math.abs(p.net)) },
                  "amount",
                )
              : fill(
                  v.hBulanSaved,
                  { month: p.label, amount: money(p.net) },
                  "amount",
                ),
          legend,
        };
      }
      break;
    }
    case "rharian": {
      const daily = d.daily;
      if (daily) {
        cover =
          daily.count > 0
            ? {
                headline: fill(
                  v.hHarianSpend,
                  {
                    amount: money(daily.totalExpense),
                    n: String(daily.count),
                  },
                  "amount",
                ),
                legend: [
                  {
                    label: v.income,
                    value: money(daily.totalIncome),
                    color: LIME,
                  },
                  {
                    label: v.expense,
                    value: money(daily.totalExpense),
                    color: EXPENSE,
                  },
                ],
              }
            : { headline: v.hHarianEmpty, legend: [] };
      }
      break;
    }
    case "rperf": {
      const rate = d.summary?.savingsRate;
      if (rate !== undefined && rate !== null) {
        const pct = String(Math.round(rate ?? 0));
        cover = {
          headline: fill(
            rate >= 30 ? v.hPerfAchieved : v.hPerfBelow,
            { pct },
            "pct",
          ),
          legend: [
            {
              label: t.laporan.savingsRateLabel,
              value: `${pct}%`,
              color: LIME,
            },
            { label: v.savingsRateTarget, value: "30%", color: MUTED },
          ],
        };
      }
      break;
    }
    case "rtahunan": {
      // The yearly summary spans several years for the trend; the cover
      // speaks for the selected (latest) year only, like the body below it.
      // Summing every year made "2026" look larger than it is.
      const points = d.yearly?.points ?? [];
      const year = points[points.length - 1];
      cover =
        d.yearly && year
          ? flow({
              ...d.yearly,
              totalIncome: year.income,
              totalExpense: year.expense,
              netSavings: year.net,
              savingsRate:
                year.income > 0
                  ? Math.round((year.net / year.income) * 100)
                  : 0,
            })
          : null;
      break;
    }
    case "rfamily":
    case "raliran":
      cover = d.summary
        ? {
            headline: fill(
              v.hSpend,
              { amount: money(d.summary.totalExpense ?? 0) },
              "amount",
            ),
            legend: [
              {
                label: v.income,
                value: money(d.summary.totalIncome ?? 0),
                color: LIME,
              },
              {
                label: v.expense,
                value: money(d.summary.totalExpense ?? 0),
                color: EXPENSE,
              },
            ],
          }
        : null;
      break;
    case "rbank": {
      const b = d.bank;
      if (b) {
        const total = b.banks.reduce((sum, x) => sum + x.balance, 0);
        cover = {
          headline: fill(
            v.hBank,
            { amount: money(total), n: String(b.banks.length) },
            "amount",
          ),
          legend: [
            { label: v.income, value: money(b.totalIncome), color: LIME },
            { label: v.expense, value: money(b.totalExpense), color: EXPENSE },
          ],
        };
      }
      break;
    }
    case "rdetail":
      cover = d.detail
        ? {
            headline: fill(v.hDetail, { n: String(d.detail.count) }, "n"),
            legend: [
              {
                label: v.income,
                value: money(d.detail.totalIncome),
                color: LIME,
              },
              {
                label: v.expense,
                value: money(d.detail.totalExpense),
                color: EXPENSE,
              },
            ],
          }
        : null;
      break;
    case "rpnl":
      cover = d.pnl
        ? {
            headline: fill(
              d.pnl.netProfit >= 0 ? v.hProfit : v.hDeficit,
              { amount: money(Math.abs(d.pnl.netProfit)) },
              "amount",
            ),
            legend: [
              { label: v.income, value: money(d.pnl.revenue), color: LIME },
              {
                label: v.expense,
                value: money(d.pnl.expenses),
                color: EXPENSE,
              },
            ],
          }
        : null;
      break;
    case "rcashflow":
      cover = d.cashflow
        ? {
            headline: fill(
              v.hCash,
              { amount: money(d.cashflow.netChange) },
              "amount",
            ),
            legend: [
              {
                label: v.closing,
                value: money(d.cashflow.closingBalance),
                color: INK,
              },
            ],
          }
        : null;
      break;
    case "rkas":
      // Arus Kas's own period cashflow statement isn't fetched for this tab
      // (only rcashflow enables that query) — `summary`'s netSavings is the
      // same net cash movement the KasSection cards already show, so the
      // headline gets a real number instead of the bare report name.
      cover = d.summary
        ? {
            headline: fill(
              v.hCash,
              { amount: money(d.summary.netSavings ?? 0) },
              "amount",
            ),
            legend: [
              {
                label: v.income,
                value: money(d.summary.totalIncome ?? 0),
                color: LIME,
              },
              {
                label: v.expense,
                value: money(d.summary.totalExpense ?? 0),
                color: EXPENSE,
              },
            ],
          }
        : null;
      break;
    case "rbalance":
    case "rasl":
      cover = d.balance
        ? {
            headline: fill(
              v.hNetWorth,
              { amount: money(d.balance.netWorth) },
              "amount",
            ),
            legend: [
              {
                label: v.assets,
                value: money(d.balance.totalAssets),
                color: LIME,
              },
              {
                label: v.liabilities,
                value: money(d.balance.totalLiabilities),
                color: EXPENSE,
              },
              { label: v.net, value: money(d.balance.netWorth), color: INK },
            ],
          }
        : null;
      break;
    case "rinv": {
      const s = d.invSummary;
      if (s) {
        const value = Number(s.totalCurrentValue);
        const cost = Number(s.totalCostBasis);
        cover = {
          headline: fill(v.hInv, { amount: money(value) }, "amount"),
          legend: [
            { label: v.cost, value: money(cost), color: MUTED },
            {
              label: v.gain,
              value: `${value >= cost ? "+" : "-"}${money(Math.abs(value - cost))}`,
              color: LIME,
            },
          ],
        };
      }
      break;
    }
    case "rpajak":
      cover = d.pph21
        ? {
            headline: fill(
              v.hTax,
              { amount: money(d.pph21.totalTax) },
              "amount",
            ),
            legend: [{ label: v.pkp, value: money(d.pph21.pkp), color: LIME }],
          }
        : null;
      break;
    default:
      cover = null;
  }
  return cover ?? { headline: name, legend: [] };
}
