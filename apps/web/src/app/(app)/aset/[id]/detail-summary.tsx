"use client";

import { ChartLine, Info } from "lucide-react";
import type { AssetLedgerDto, AssetValueChangeDto } from "@wealthme/contracts";
import { TrendChart } from "@/components/charts/apex-presets";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import { fillCopy } from "../aset-model";
import {
  costTotal,
  currentPrice,
  fmtCurrency,
  fmtDay,
  fmtPctSigned,
  idr,
  signedIdr,
  toneOf,
  unrealized,
  withUnit,
} from "./detail-model";

/**
 * R10 — the value chart plots only stored rows: each active history event
 * (opening, valuation, trade) is one point at its effective date. Fewer than
 * two points → an explicit empty state, never a synthetic line.
 */
export function ValueChart({ ledger }: { ledger: AssetLedgerDto }) {
  const { t, locale } = useLocale();
  const d = t.aset.v3.detail;
  const money = useMoney();
  const points = ledger.events
    .filter((e) => e.status === "active")
    .slice()
    .reverse();
  const format = (v: number) => money.formatExact(BigInt(Math.round(v)));
  return (
    <section className="ad-card ad-chart" aria-labelledby="ad-chart-title">
      <div className="ad-card-head">
        <h2 id="ad-chart-title">{d.chartTitle}</h2>
        <span className="ad-legend">
          <i aria-hidden="true" />
          {d.chartLegend}
        </span>
      </div>
      {money.hideBalance ? (
        <p className="ad-empty">••••</p>
      ) : points.length < 2 ? (
        <p className="ad-empty">
          <ChartLine aria-hidden="true" />
          {d.chartEmpty}
        </p>
      ) : (
        <TrendChart
          categories={points.map((e) => fmtDay(e.effectiveDate, locale))}
          series={[
            {
              name: d.chartLegend,
              data: points.map((e) => Number(idr(e.value))),
            },
          ]}
          ariaLabel={d.chartTitle}
          money={{ format, formatAxis: (v: number) => money.formatAxis(v) }}
        />
      )}
      <small className="ad-note">{d.chartNote}</small>
    </section>
  );
}

function ChangeRow({
  title,
  change,
  none,
}: {
  title: string;
  change: AssetValueChangeDto;
  none: string;
}) {
  const { t, locale } = useLocale();
  const d = t.aset.v3.detail;
  const money = useMoney();
  const has = change.period !== "none" && change.amountIdr !== null;
  const tone = toneOf(change.amountIdr);
  return (
    <div className="ad-change">
      <div className="ad-change-head">
        <span>{title}</span>
        <strong className="ad-num" data-tone={has ? tone : undefined}>
          {has ? signedIdr(change.amountIdr!, money.formatExact) : "—"}
          {has && change.percent !== null && (
            <small> ({fmtPctSigned(change.percent, locale)})</small>
          )}
          {has && tone !== "flat" && (
            <span className="sr-only">{tone === "up" ? d.up : d.down}</span>
          )}
        </strong>
      </div>
      <p className="ad-change-note">
        <Info aria-hidden="true" />
        {has && change.comparisonDate
          ? fillCopy(d.todayVs, {
              date: fmtDay(change.comparisonDate, locale),
            })
          : none}
      </p>
    </div>
  );
}

/** "Rincian perhitungan": every figure with the formula that produced it. */
export function CalculationCard({
  ledger,
  unit,
}: {
  ledger: AssetLedgerDto;
  unit: string | null;
}) {
  const { t, locale } = useLocale();
  const d = t.aset.v3.detail;
  const money = useMoney();
  const state = ledger.asset;
  const price = currentPrice(ledger);
  const cost = costTotal(state);
  const pnl = unrealized(state);
  const fmt = (v: string) => money.formatExact(idr(v));
  const priceText = price
    ? fmtCurrency(price.value, price.currency, locale, money.formatExact)
    : null;
  const perUnit = state.valuationModel === "per_unit";
  return (
    <section className="ad-card ad-calc" aria-labelledby="ad-calc-title">
      <h2 id="ad-calc-title">{d.calcTitle}</h2>
      <dl className="ad-calc-list">
        {perUnit && (
          <>
            <div>
              <dt>{d.calcQty}</dt>
              <dd className="ad-num">
                {withUnit(state.quantity, unit, locale)}
              </dd>
            </div>
            <div>
              <dt>{d.calcPrice}</dt>
              <dd className="ad-num">
                {priceText ? `${priceText}${unit ? ` / ${unit}` : ""}` : "—"}
              </dd>
            </div>
          </>
        )}
        <div className="ad-calc-key">
          <dt>
            {d.calcValue}
            <small>
              {perUnit && priceText
                ? `${withUnit(state.quantity, unit, locale)} × ${priceText}`
                : d.calcValueTotal}
            </small>
          </dt>
          <dd className="ad-num">{fmt(state.currentValueIdr)}</dd>
        </div>
      </dl>
      <dl className="ad-calc-list">
        <div>
          <dt>{d.calcCost}</dt>
          <dd className="ad-num">{cost ? fmt(cost) : "—"}</dd>
        </div>
        <div>
          <dt>{d.calcDiff}</dt>
          <dd className="ad-num" data-tone={toneOf(pnl?.amount)}>
            {pnl ? signedIdr(pnl.amount, money.formatExact) : "—"}
          </dd>
        </div>
        <div>
          <dt>
            {d.calcPct}
            {pnl && cost && (
              <small>
                ({money.formatExact(idr(state.currentValueIdr))} −{" "}
                {money.formatExact(idr(cost))}) / {money.formatExact(idr(cost))}
              </small>
            )}
          </dt>
          <dd className="ad-num" data-tone={toneOf(pnl?.amount)}>
            {fmtPctSigned(pnl?.percent ?? null, locale)}
          </dd>
        </div>
        {state.realizedPnlIdr !== null && (
          <div>
            <dt>{d.calcRealized}</dt>
            <dd className="ad-num" data-tone={toneOf(state.realizedPnlIdr)}>
              {signedIdr(state.realizedPnlIdr, money.formatExact)}
            </dd>
          </div>
        )}
      </dl>
      <ChangeRow
        title={d.todayTitle}
        change={ledger.todayChange}
        none={d.todayNone}
      />
      <ChangeRow
        title={d.sinceLastTitle}
        change={ledger.sinceLastValuation}
        none={d.sinceLastNone}
      />
    </section>
  );
}

/** Exported for the history rows: the A6 change of one value row. */
export function changeText(
  amount: string | null,
  percent: number | null,
  locale: string,
  formatExact: (n: bigint) => string,
): string | null {
  if (amount === null) return null;
  const p = percent === null ? "" : ` (${fmtPctSigned(percent, locale)})`;
  return `${signedIdr(amount, formatExact)}${p}`;
}
