"use client";
import type {
  InvestmentDto,
  InvestmentValuationDto,
} from "@wealthme/contracts";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import { divide, positive } from "../decimal";
import { money, quantity } from "../portfolio-model";
import { percentPrice } from "../price-unit";
export function DetailCalculation({
  holding: h,
  valuation: v,
}: {
  holding: InvestmentDto;
  valuation: InvestmentValuationDto;
}) {
  const { t, locale } = useLocale();
  const d = t.investasi.detail;
  const c = t.investasi.v3;
  const { hideBalance } = useMoney();
  const fmt = (
    n: string | null | undefined,
    currency = "IDR",
    digits?: number,
  ) => money(n, currency, locale, hideBalance, digits);
  const average =
    v.costRemainingIdr !== null && positive(h.quantity)
      ? divide(v.costRemainingIdr, h.quantity)
      : null;
  const price = v.price
    ? percentPrice(h)
      ? hideBalance
        ? "••••"
        : `${v.price.value}%`
      : fmt(v.price.value, v.price.currency, 8)
    : "—";
  const formula =
    v.method === "deposit_accrual"
      ? d.depositFormula
      : v.bond?.convention === "percent_of_par"
        ? d.bondFormula
        : d.quantityFormula;
  return (
    <aside className="iv-card iv-calculation">
      <h2>{d.calculation}</h2>
      <dl>
        <div>
          <dt>{t.investasi.forms.quantity}</dt>
          <dd>{hideBalance ? "••••" : quantity(h, c, locale)}</dd>
        </div>
        <div>
          <dt>
            {d.average}
            <small>{d.averageIdr}</small>
          </dt>
          <dd>{fmt(average, "IDR", 8)}</dd>
        </div>
        <div>
          <dt>{d.remainingCost}</dt>
          <dd>{fmt(v.costRemainingIdr)}</dd>
        </div>
        <div>
          <dt>
            {d.currentPrice}
            <small>{v.price?.unitLabel}</small>
          </dt>
          <dd>{price}</dd>
        </div>
        {v.deposit && (
          <>
            <div>
              <dt>{d.principal}</dt>
              <dd>{fmt(v.deposit.principal, v.deposit.currency)}</dd>
            </div>
            <div>
              <dt>
                {d.accrued}
                <small>
                  {v.deposit.days} · {v.deposit.dayCount}
                </small>
              </dt>
              <dd>{fmt(v.deposit.accruedInterest, v.deposit.currency)}</dd>
            </div>
          </>
        )}
        {v.bond && (
          <>
            <div>
              <dt>{d.principal}</dt>
              <dd>
                {fmt(v.bond.principal, v.marketValueCurrency ?? h.currency)}
              </dd>
            </div>
            <div>
              <dt>{d.accrued}</dt>
              <dd>
                {fmt(v.bond.accruedCoupon, v.marketValueCurrency ?? h.currency)}
              </dd>
            </div>
          </>
        )}
        <div>
          <dt>
            {d.marketValue}
            <small>{formula}</small>
          </dt>
          <dd>{fmt(v.marketValueIdr)}</dd>
        </div>
        {v.valuationFx && (
          <div>
            <dt>
              {t.investasi.prices.fx}
              <small>
                {v.valuationFx.rateDate} · {v.valuationFx.source}
              </small>
            </dt>
            <dd>
              {fmt(v.valuationFx.idrPerUnit, "IDR", 8)} /{" "}
              {v.valuationFx.currency}
            </dd>
          </div>
        )}
        <div
          className="ivd-calc-total"
          data-sign={
            hideBalance
              ? undefined
              : v.unrealizedIdr?.startsWith("-")
                ? "down"
                : v.unrealizedIdr && /[1-9]/.test(v.unrealizedIdr)
                  ? "up"
                  : undefined
          }
        >
          <dt>
            {d.unrealized}
            <small>{d.difference}</small>
          </dt>
          <dd>
            {fmt(v.unrealizedIdr)}
            <small>
              {hideBalance || v.unrealizedPct === null
                ? "—"
                : `${v.unrealizedPct}%`}
            </small>
          </dd>
        </div>
      </dl>
      <p className="ivd-calc-note">{d.sellCosts}</p>
      <small className="ivd-calc-note">{d.valuationNote}</small>
      {v.costBasisKnown === false && <p className="iv-notice">{d.basisNote}</p>}
    </aside>
  );
}
