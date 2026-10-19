"use client";
import { AlertCircle } from "lucide-react";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import type { InvestmentPortfolioValuationDto } from "@wealthme/contracts";
import { portfolioMoney } from "./portfolio-model";

export function PortfolioSummary({
  data,
}: {
  data?: InvestmentPortfolioValuationDto;
}) {
  const { t, locale } = useLocale();
  const c = t.investasi.v3;
  const { hideBalance } = useMoney();
  const totals = data?.totals;
  const currency = data?.displayCurrency ?? "IDR";
  const fmt = (value: Parameters<typeof portfolioMoney>[0]) =>
    portfolioMoney(value, currency, locale, hideBalance);
  const prices = data?.holdings
    .flatMap((h) => (h.price ? [h.price] : []))
    .sort((a, b) => b.asOf.localeCompare(a.asOf));
  const last = prices?.[0];
  return (
    <>
      <section className="iv-card iv-summary" aria-label={c.total}>
        <div className="iv-total">
          <span>{c.total}</span>
          <p>{fmt(totals?.total)}</p>
          <small>
            {c.assetValue} {fmt(totals?.assetValue)} + {c.cash}{" "}
            {fmt(totals?.platformCash.recorded)}
          </small>
        </div>
        <div>
          <span>{c.capital}</span>
          <strong>{fmt(totals?.costRemaining)}</strong>
          <small>{c.weighted}</small>
        </div>
        <div>
          <span>{c.unrealized}</span>
          <strong>
            {totals && Number(totals.unrealized.idr) > 0 && !hideBalance
              ? "+"
              : ""}
            {fmt(totals?.unrealized)}
          </strong>
          <small>
            {hideBalance || totals?.unrealizedPct == null
              ? "—"
              : `${totals.unrealizedPct > 0 ? "+" : ""}${totals.unrealizedPct}%`}
          </small>
          <span>
            {c.realized}: {fmt(totals?.realized)}
          </span>
        </div>
        <div>
          <span>{c.lastPrice}</span>
          <strong className="iv-date">
            {last
              ? new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
                  dateStyle: "medium",
                  ...(last.hasTime ? { timeStyle: "short" as const } : {}),
                  timeZone: "Asia/Jakarta",
                }).format(new Date(last.asOf))
              : "—"}
          </strong>
          <small>Asia/Jakarta{last ? ` · ${last.source}` : ""}</small>
          {data?.displayFx && (
            <small>
              {c.displayFx}: {data.displayFx.idrPerUnit} IDR ·{" "}
              {data.displayFx.rateDate} · {data.displayFx.source}
            </small>
          )}
        </div>
      </section>
      {totals?.incomplete && (
        <p className="iv-notice" role="status">
          <AlertCircle aria-hidden="true" />
          {c.incomplete} {c.unpricedCost}: {fmt(totals.unpricedCost)}
        </p>
      )}
      {!!totals?.platformCash.hiddenPocketCount && (
        <p className="iv-notice">{c.hiddenCash}</p>
      )}
      {currency !== "IDR" && data && !data.displayFx && (
        <p className="iv-notice">{c.unavailableFx}</p>
      )}
    </>
  );
}
