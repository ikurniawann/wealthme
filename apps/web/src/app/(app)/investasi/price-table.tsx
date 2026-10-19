"use client";
import { MANUAL_PRICE_SOURCES } from "@wealthme/contracts";
import type {
  InvestmentDto,
  InvestmentValuationDto,
  ManualPriceSource,
  InvestmentPriceBatchResultDto,
} from "@wealthme/contracts";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import { AmountInput } from "./investment-fields";
import { percentPrice, priceUnit } from "./price-unit";
import { money } from "./portfolio-model";
import type { FeedResult } from "./price-results";
export interface PriceEntry {
  price: string;
  source: ManualPriceSource;
}
export function PriceTable({
  holdings,
  valuations,
  entries,
  onChange,
  mode,
  result,
  feeds,
  disabled,
}: {
  holdings: InvestmentDto[];
  valuations: InvestmentValuationDto[];
  entries: Record<string, PriceEntry>;
  onChange: (id: string, entry: PriceEntry) => void;
  mode: "manual" | "feed";
  result?: InvestmentPriceBatchResultDto | null;
  feeds: FeedResult[];
  disabled: boolean;
}) {
  const { t, locale } = useLocale();
  const p = t.investasi.prices;
  const c = t.investasi.v3;
  const { hideBalance } = useMoney();
  if (!holdings.length) return <p>{p.noRows}</p>;
  return (
    <div className="iv-table-scroll">
      <table className="iv-price-table">
        <thead>
          <tr>
            <th>{c.instrument}</th>
            <th>{p.previous}</th>
            {mode === "manual" && (
              <>
                <th>{p.next}</th>
                <th>{p.source}</th>
              </>
            )}
            <th>{p.status}</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            const feed = feeds.find((r) => r.investmentId === h.id);
            const v =
              feed?.valuation ??
              valuations.find((v) => v.investmentId === h.id);
            const row = result?.rows.find((r) => r.investmentId === h.id);
            const entry = entries[h.id] ?? { price: "", source: "manual" };
            const unit = priceUnit(h);
            const auto =
              (h.type === "saham" || h.type === "kripto") &&
              !h.details?.manualInstrument;
            const status =
              mode === "manual"
                ? row
                  ? p[row.status]
                  : entry.price.trim()
                    ? p.ready
                    : p.empty
                : feed?.status === "updated"
                  ? p.updated
                  : !auto
                    ? p.manualOnly
                    : feed?.feed?.state === "simulated"
                      ? p.simulated
                      : feed?.feed?.state === "failed" ||
                          feed?.feed?.state === "no_route"
                        ? p.failed
                        : feed
                          ? p.retained
                          : "—";
            return (
              <tr key={h.id}>
                <td>
                  <strong>{h.name}</strong>
                  <small>
                    {h.ticker} · {h.market ?? c.completeMarket}
                  </small>
                  <small>{unit}</small>
                </td>
                <td>
                  {v?.price
                    ? percentPrice(h)
                      ? `${hideBalance ? "••••" : v.price.value}%`
                      : money(
                          v.price.value,
                          v.price.currency,
                          locale,
                          hideBalance,
                          8,
                        )
                    : "—"}
                  <small>
                    {v?.price
                      ? new Intl.DateTimeFormat(
                          locale === "id" ? "id-ID" : "en-US",
                          {
                            dateStyle: "medium",
                            timeZone: "Asia/Jakarta",
                            ...(v.price.hasTime
                              ? { timeStyle: "short" as const }
                              : {}),
                          },
                        ).format(new Date(v.price.asOf))
                      : "—"}
                  </small>
                  <small>{v?.price?.source ?? "—"}</small>
                </td>
                {mode === "manual" && (
                  <>
                    <td>
                      <AmountInput
                        label={`${p.next}: ${h.name}`}
                        value={entry.price}
                        onChange={(price) =>
                          onChange(h.id, { ...entry, price })
                        }
                        currency={percentPrice(h) ? "%" : h.currency}
                        decimals={8}
                      />
                    </td>
                    <td>
                      <select
                        className="select"
                        aria-label={`${p.source}: ${h.name}`}
                        value={entry.source}
                        disabled={disabled}
                        onChange={(e) =>
                          onChange(h.id, {
                            ...entry,
                            source: e.target.value as ManualPriceSource,
                          })
                        }
                      >
                        {MANUAL_PRICE_SOURCES.map((source) => (
                          <option key={source} value={source}>
                            {p.sources[source]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </>
                )}
                <td>
                  <span role="status">{status}</span>
                  {row?.code && (
                    <small>
                      {locale === "id"
                        ? row.message
                        : row.code.replaceAll("_", " ")}
                    </small>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
