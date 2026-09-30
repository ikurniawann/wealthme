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
};

type Legend = { label: string; value: string; color: string };
type Cover = { headline: ReactNode; legend: Legend[] };

const LIME = "var(--wm-lime)";
const ORANGE = "var(--wm-orange)";
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
      { label: v.income, value: money(s.totalIncome), color: LIME },
      { label: v.expense, value: money(s.totalExpense), color: ORANGE },
      { label: v.saved, value: money(s.netSavings), color: INK },
    ];
    if (s.netSavings < 0)
      return {
        headline: fill(
          v.hDeficit,
          { amount: money(Math.abs(s.netSavings)) },
          "amount",
        ),
        legend,
      };
    return {
      headline: fill(
        v.hSaved,
        { amount: money(s.netSavings), pct: String(Math.round(s.savingsRate)) },
        "amount",
      ),
      legend,
    };
  };
  let cover: Cover | null = null;
  switch (tab) {
    case "rsum":
    case "rbulanan":
    case "rharian":
    case "rperf":
      cover = flow(d.summary);
      break;
    case "rtahunan":
      cover = flow(d.yearly);
      break;
    case "rfamily":
    case "raliran":
      cover = d.summary
        ? {
            headline: fill(
              v.hSpend,
              { amount: money(d.summary.totalExpense) },
              "amount",
            ),
            legend: [
              {
                label: v.income,
                value: money(d.summary.totalIncome),
                color: LIME,
              },
              {
                label: v.expense,
                value: money(d.summary.totalExpense),
                color: ORANGE,
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
            { label: v.expense, value: money(b.totalExpense), color: ORANGE },
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
                color: ORANGE,
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
              { label: v.expense, value: money(d.pnl.expenses), color: ORANGE },
            ],
          }
        : null;
      break;
    case "rcashflow":
    case "rkas":
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
                color: ORANGE,
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
              value: `${value >= cost ? "+" : "−"}${money(Math.abs(value - cost))}`,
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
