"use client";
import { ChartColumn, Clock, Info } from "lucide-react";
import type { InvestmentDto, PlatformPocketDto } from "@wealthme/contracts";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import type { PositionState } from "./position-state";
import { subtract, add, decimal } from "./decimal";
import { money, quantity } from "./portfolio-model";
import { today } from "./investment-fields";
import { baseUnitLabel } from "./position-execution-fields";
import { breakdown, priceMoney, safeNumbers } from "./position-preview";
import { tradeCopy } from "./trade-copy";

/** Buy/sell summary: gross, total debit or net proceeds, what remains. */
export function TradePreview({
  value,
  holding,
  pocket,
  settlement,
}: {
  value: PositionState;
  holding: InvestmentDto;
  pocket?: PlatformPocketDto;
  settlement: string;
}) {
  const { t, locale } = useLocale();
  const c = t.investasi.v3;
  const f = t.investasi.forms;
  const copy = tradeCopy(locale);
  const { hideBalance } = useMoney();
  const n = safeNumbers(value);
  const sell = value.mode === "sell";
  const fmt = (v: string | null | undefined) =>
    money(v, value.currency, locale, hideBalance);
  const idr = (v: string | null | undefined) =>
    money(v, "IDR", locale, hideBalance);
  const held = sell && settlement > today();
  const after =
    pocket?.availableBalance != null && n?.debitIdr
      ? sell
        ? held
          ? pocket.availableBalance
          : add(pocket.availableBalance, n.debitIdr)
        : subtract(pocket.availableBalance, n.debitIdr)
      : null;
  const short = after !== null && decimal(after) < BigInt(0);
  const remaining = n
    ? sell
      ? subtract(holding.quantity, n.quantity)
      : add(holding.quantity, n.quantity)
    : null;
  const oversold = remaining !== null && decimal(remaining) < BigInt(0);
  return (
    <>
      <section className="ivx-sum" aria-live="polite">
        <h3 className="ivx-sum-title">
          <ChartColumn aria-hidden="true" />
          {sell ? copy.sellSummary : copy.buySummary}
        </h3>
        <dl className="ivx-sum-list">
          <div>
            <dt>{f.gross}</dt>
            <dd>{fmt(n?.gross)}</dd>
          </div>
          <div>
            <dt>
              {sell ? f.netProceeds : copy.totalDebit}
              <small>
                {breakdown(
                  value,
                  n,
                  locale,
                  fmt,
                  baseUnitLabel(value, c),
                  (v) => priceMoney(v, value.currency, locale, hideBalance),
                )}
              </small>
            </dt>
            <dd>
              {fmt(n?.debit)}
              {value.currency !== "IDR" && n?.debitIdr && (
                <small>≈ {idr(n.debitIdr)}</small>
              )}
            </dd>
          </div>
          <div className="ivx-sum-key">
            <dt>{f.remainingHoldings}</dt>
            <dd data-tone={oversold ? "bad" : remaining ? "good" : undefined}>
              {hideBalance
                ? "••••"
                : remaining !== null
                  ? quantity({ ...holding, quantity: remaining }, c, locale)
                  : "—"}
            </dd>
          </div>
          <div className="ivx-sum-key">
            <dt>
              {sell ? copy.fundsAfterSell : copy.fundsAfter}
              <small>
                {c.available}: {idr(pocket?.availableBalance)}
              </small>
            </dt>
            <dd data-tone={short ? "bad" : after !== null ? "good" : undefined}>
              {idr(after)}
            </dd>
          </div>
        </dl>
        <p className="ivx-sum-note">
          {f.estimated} · {f.currentBalance}
        </p>
      </section>
      {held && (
        <p className="ivx-strip" data-tone="warn">
          <Clock aria-hidden="true" />
          {f.pendingProceeds}
        </p>
      )}
      <p className="ivx-strip">
        <Info aria-hidden="true" />
        {f.noOrder}
      </p>
    </>
  );
}
