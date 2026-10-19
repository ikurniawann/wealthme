"use client";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import type { PlatformPocketDto } from "@wealthme/contracts";
import { positionNumbers } from "./position-state";
import type { PositionState } from "./position-state";
import { money } from "./portfolio-model";
import { subtract } from "./decimal";
import { amount } from "./investment-fields";
export function PositionPreview({
  value,
  pocket,
}: {
  value: PositionState;
  pocket?: PlatformPocketDto;
}) {
  const { t, locale } = useLocale();
  const c = t.investasi.v3;
  const f = t.investasi.forms;
  const { hideBalance } = useMoney();
  let n: ReturnType<typeof positionNumbers> | null = null;
  try {
    n = positionNumbers(value);
  } catch {
    /* Incomplete quantity input has no estimate. */
  }
  const fmt = (v: string | null | undefined, currency = value.currency) =>
    money(v, currency, locale, hideBalance);
  return (
    <section className="iv-transfer-preview">
      <h2>{f.estimated}</h2>
      {value.mode === "opening" && !value.knownCost ? (
        <p>{f.costUnknown}</p>
      ) : (
        <>
          <p>
            {f.gross}: {fmt(n?.gross)}
          </p>
          <small>
            {n?.quantity ?? "—"}{" "}
            {value.market === "IDX"
              ? c.lembar
              : value.type === "saham"
                ? c.shares
                : c.units}{" "}
            ×{" "}
            {value.type === "obligasi" &&
            value.details.priceConvention === "percent_of_par"
              ? n
                ? `${new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US", { maximumFractionDigits: 8 }).format(Number(n.price))}%`
                : "—"
              : fmt(n?.price)}{" "}
            + {fmt(amount(value.fee))} + {fmt(amount(value.tax))}
          </small>
          <p>
            {value.mode === "opening" ? c.capital : f.totalDebit}:{" "}
            {fmt(n?.debit)}
          </p>
        </>
      )}
      {value.mode === "buy" && (
        <>
          <p>
            {c.available}: {fmt(pocket?.availableBalance, "IDR")}
          </p>
          <p>
            {f.after}:{" "}
            {fmt(
              pocket?.availableBalance != null && n?.debitIdr
                ? subtract(pocket.availableBalance, n.debitIdr)
                : null,
              "IDR",
            )}
          </p>
          <small>{f.currentBalance}</small>
        </>
      )}
      <p>{value.mode === "opening" ? f.openingNote : f.noOrder}</p>
    </section>
  );
}
