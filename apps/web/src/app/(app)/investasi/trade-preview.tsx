"use client";
import type { InvestmentDto, PlatformPocketDto } from "@wealthme/contracts";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import { positionNumbers } from "./position-state";
import type { PositionState } from "./position-state";
import { subtract, add } from "./decimal";
import { money, quantity } from "./portfolio-model";
import { today } from "./investment-fields";
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
  const { hideBalance } = useMoney();
  let n: ReturnType<typeof positionNumbers> | null = null;
  try {
    n = positionNumbers(value);
  } catch {
    /* Partial input has no estimate. */
  }
  const fmt = (v: string | null | undefined, currency = value.currency) =>
    money(v, currency, locale, hideBalance);
  const held = value.mode === "sell" && settlement > today();
  return (
    <section className="iv-transfer-preview">
      <h2>{f.estimated}</h2>
      <p>
        {f.gross}: {fmt(n?.gross)}
      </p>
      <p>
        {value.mode === "sell" ? f.netProceeds : f.totalDebit}: {fmt(n?.debit)}
      </p>
      <p>
        {f.remainingHoldings}:{" "}
        {hideBalance
          ? "••••"
          : n
            ? quantity(
                {
                  ...holding,
                  quantity:
                    value.mode === "sell"
                      ? subtract(holding.quantity, n.quantity)
                      : add(holding.quantity, n.quantity),
                },
                c,
                locale,
              )
            : "—"}
      </p>
      <p>
        {c.available} (IDR): {fmt(pocket?.availableBalance, "IDR")} →{" "}
        {fmt(
          pocket?.availableBalance != null && n?.debitIdr
            ? value.mode === "sell"
              ? held
                ? pocket.availableBalance
                : add(pocket.availableBalance, n.debitIdr)
              : subtract(pocket.availableBalance, n.debitIdr)
            : null,
          "IDR",
        )}
      </p>
      {held && <p className="iv-notice">{f.pendingProceeds}</p>}
      <small>{f.currentBalance}</small>
      <p>{f.noOrder}</p>
    </section>
  );
}
