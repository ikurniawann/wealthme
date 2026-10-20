"use client";
import type {
  InvestmentDto,
  InvestmentPriceBatchResultDto,
  InvestmentValuationDto,
} from "@wealthme/contracts";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import { money } from "./portfolio-model";
import { priceCopy } from "./price-copy";
import {
  formatPrice,
  InstrumentCell,
  marketLine,
  PriceChip,
} from "./price-table";

export interface FeedResult {
  investmentId: string;
  status: "updated" | "skipped" | "failed";
  valuation: InvestmentValuationDto;
  feed: {
    state: "ok" | "failed" | "no_route" | "simulated";
    at: string;
    error: string | null;
  } | null;
}

/** "+Rp 100.000" / "−Rp 5.000" with the sign glued to the amount. */
function signed(value: string, locale: string, hidden: boolean) {
  const n = BigInt(value);
  const abs = money((n < BigInt(0) ? -n : n).toString(), "IDR", locale, hidden);
  if (n === BigInt(0)) return abs;
  return `${n > BigInt(0) ? "+" : "−"}${abs}`;
}

function pct(impact: string, base: string | null, locale: string) {
  if (!base || Number(base) <= 0) return null;
  const value = (Number(impact) / Number(base)) * 100;
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${new Intl.NumberFormat(
    locale === "id" ? "id-ID" : "en-US",
    { maximumFractionDigits: 2, minimumFractionDigits: 2 },
  ).format(Math.abs(value))}%`;
}

/**
 * The server's preview / save result per holding: the new market value
 * (quantity × new price), the previous value and the net-worth difference;
 * skipped and failed rows say why. Nothing here is computed client-side
 * except the percentage.
 */
export function PriceResults({
  result,
  holdings,
  valuations,
}: {
  result: InvestmentPriceBatchResultDto;
  holdings: InvestmentDto[];
  valuations: InvestmentValuationDto[];
}) {
  const { t, locale } = useLocale();
  const c = t.investasi.v3;
  const copy = priceCopy(locale);
  const { hideBalance } = useMoney();
  const fmt = (v: string | null) => money(v, "IDR", locale, hideBalance);
  const qtyFmt = new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US", {
    maximumFractionDigits: 8,
  });
  // Blank rows are the normal case (most holdings are not repriced at once):
  // one line for them instead of a card each.
  const blank = result.rows.filter(
    (r) => r.status === "skipped" && r.code === "empty_price",
  ).length;
  const rows = result.rows
    .filter((r) => !(r.status === "skipped" && r.code === "empty_price"))
    .sort(
      (a, b) =>
        Number(b.status === "updated") - Number(a.status === "updated") ||
        a.index - b.index,
    );
  return (
    <>
      <ul className="ivp-preview-list">
        {rows.map((r) => {
          const h = holdings.find((x) => x.id === r.investmentId);
          const v = valuations.find((x) => x.investmentId === r.investmentId);
          const marketLabel = h
            ? marketLine(h, c[h.type], c.completeMarket)
            : "";
          const change = r.impactIdr
            ? pct(r.impactIdr, r.oldValueIdr, locale)
            : null;
          const tone =
            r.impactIdr && BigInt(r.impactIdr) < BigInt(0) ? "down" : "up";
          return (
            <li
              key={r.investmentId}
              className="ivp-preview-row"
              data-status={r.status}
            >
              {h ? (
                <InstrumentCell holding={h} marketLabel={marketLabel} />
              ) : (
                <strong>{r.name ?? "—"}</strong>
              )}
              {r.status === "updated" ? (
                <>
                  <div className="ivp-preview-cell">
                    <small>
                      {v && r.newPrice && h
                        ? `${qtyFmt.format(Number(v.quantity))} × ${formatPrice(h, r.newPrice, r.newCurrency ?? h.currency, locale, hideBalance)}`
                        : copy.newValue}
                    </small>
                    <strong className="ivp-num ivp-big">
                      {fmt(r.newValueIdr)}
                    </strong>
                  </div>
                  <div className="ivp-preview-cell">
                    <small>{copy.previousValue}</small>
                    <span className="ivp-num">
                      {r.oldValueIdr ? fmt(r.oldValueIdr) : copy.unpricedBefore}
                    </span>
                  </div>
                  <div className="ivp-preview-cell" data-tone={tone}>
                    <small>{copy.impact}</small>
                    <strong className="ivp-num">
                      {r.impactIdr
                        ? signed(r.impactIdr, locale, hideBalance)
                        : "—"}
                    </strong>
                    <small>{change ?? copy.impactNote}</small>
                  </div>
                </>
              ) : (
                <div className="ivp-preview-cell ivp-preview-why">
                  <PriceChip tone={r.status === "failed" ? "fail" : "skip"}>
                    {r.status === "failed" ? copy.failed : copy.skipped}
                  </PriceChip>
                  <small>
                    {r.code
                      ? locale === "id"
                        ? r.message
                        : r.code.replaceAll("_", " ")
                      : null}
                  </small>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {blank > 0 && (
        <p className="ivp-muted ivp-blank-note">{copy.blankKept(blank)}</p>
      )}
    </>
  );
}
