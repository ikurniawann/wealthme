"use client";
import { ChartColumn } from "lucide-react";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import type { PlatformPocketDto } from "@wealthme/contracts";
import { positionNumbers } from "./position-state";
import type { PositionState } from "./position-state";
import { money } from "./portfolio-model";
import { decimal, positive, subtract } from "./decimal";
import { amount } from "./investment-fields";
import { baseUnitLabel } from "./position-execution-fields";
import { tradeCopy } from "./trade-copy";

/** "(200 lembar × Rp 9.500) + Rp 2.850" — the estimate's working. */
export function breakdown(
  value: PositionState,
  n: ReturnType<typeof positionNumbers> | null,
  locale: string,
  fmt: (v: string | null | undefined) => string,
  unit: string,
  priceFmt: (v: string) => string = fmt,
) {
  if (!n) return "—";
  const num = new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US", {
    maximumFractionDigits: 8,
  });
  const percent =
    value.type === "obligasi" &&
    value.details.priceConvention === "percent_of_par";
  const price = percent ? `${num.format(Number(n.price))}%` : priceFmt(n.price);
  const sign = value.mode === "sell" ? "−" : "+";
  const costs = [amount(value.fee), amount(value.tax)]
    .filter((v) => positive(v))
    .map((v) => ` ${sign}\u00a0${fmt(v)}`)
    .join("");
  return `(${num.format(Number(n.quantity))} ${unit} × ${price})${costs}`;
}

/** Unit price with up to 8 decimals and no padded zeros ("Rp 9.500"). */
export function priceMoney(
  value: string | null | undefined,
  currency: string,
  locale: string,
  hidden: boolean,
) {
  if (hidden) return "••••";
  if (value == null) return "—";
  return new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "IDR" ? 0 : 2,
    maximumFractionDigits: 8,
  }).format(Number(value));
}

export function safeNumbers(value: PositionState) {
  try {
    const n = positionNumbers(value);
    // An empty quantity is "no estimate yet", not a Rp 0 trade.
    return positive(n.quantity) ? n : null;
  } catch {
    /* Incomplete input has no estimate. */
    return null;
  }
}

/** Estimate block of the add-investment drawer (spec §5/§7). */
export function PositionPreview({
  value,
  pocket,
  pocketLabel,
}: {
  value: PositionState;
  pocket?: PlatformPocketDto;
  pocketLabel?: string;
}) {
  const { t, locale } = useLocale();
  const c = t.investasi.v3;
  const f = t.investasi.forms;
  const copy = tradeCopy(locale);
  const { hideBalance } = useMoney();
  const n = safeNumbers(value);
  const fmt = (v: string | null | undefined) =>
    money(v, value.currency, locale, hideBalance);
  const unitPrice = (v: string) =>
    priceMoney(v, value.currency, locale, hideBalance);
  const idr = (v: string | null | undefined) =>
    money(v, "IDR", locale, hideBalance);
  const unknown = value.mode === "opening" && !value.knownCost;
  const after =
    pocket?.availableBalance != null && n?.debitIdr
      ? subtract(pocket.availableBalance, n.debitIdr)
      : null;
  const short = after !== null && decimal(after) < BigInt(0);
  const foreign = value.currency !== "IDR";
  return (
    <section className="ivx-sum" aria-live="polite">
      <h3 className="ivx-sum-title">
        <ChartColumn aria-hidden="true" />
        {value.mode === "opening" ? copy.openingSummary : copy.buySummary}
      </h3>
      {unknown ? (
        <p className="ivx-sum-note">{f.costUnknown}</p>
      ) : (
        <dl className="ivx-sum-grid">
          {value.mode === "buy" && (
            <div>
              <dt>{c.available}</dt>
              <dd>{idr(pocket?.availableBalance)}</dd>
              {pocketLabel && <small>{pocketLabel}</small>}
            </div>
          )}
          <div>
            <dt>{value.mode === "opening" ? c.capital : copy.totalDebit}</dt>
            <dd>{fmt(n?.debit)}</dd>
            <small>
              {breakdown(
                value,
                n,
                locale,
                fmt,
                baseUnitLabel(value, c),
                unitPrice,
              )}
            </small>
            {foreign && n?.debitIdr && <small>≈ {idr(n.debitIdr)}</small>}
          </div>
          {value.mode === "buy" && (
            <div>
              <dt>{copy.fundsAfter}</dt>
              <dd
                data-tone={short ? "bad" : after !== null ? "good" : undefined}
              >
                {idr(after)}
              </dd>
              {pocketLabel && <small>{pocketLabel}</small>}
            </div>
          )}
        </dl>
      )}
      <p className="ivx-sum-note">
        {value.mode === "opening" ? f.openingNote : f.estimated}
        {value.mode === "buy" ? ` · ${f.currentBalance}` : ""}
      </p>
    </section>
  );
}
