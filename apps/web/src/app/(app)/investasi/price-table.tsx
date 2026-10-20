"use client";
import {
  CircleCheck,
  CircleDashed,
  CircleMinus,
  CircleX,
  Clock3,
} from "lucide-react";
import type { ReactNode } from "react";
import { MANUAL_PRICE_SOURCES, MARKETS } from "@wealthme/contracts";
import type {
  InvestmentDto,
  InvestmentValuationDto,
  InvestmentValuationPriceDto,
  ManualPriceSource,
  InvestmentPriceBatchResultDto,
} from "@wealthme/contracts";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import { formatMoneyTyping } from "@/components/money";
import { currencyMark } from "./investment-fields";
import { percentPrice, priceUnit } from "./price-unit";
import { money } from "./portfolio-model";
import { priceCopy } from "./price-copy";
import type { PriceCopy } from "./price-copy";
import type { FeedResult } from "./price-results";
import { TYPE_ICONS } from "./type-icons";

export interface PriceEntry {
  price: string;
  source: ManualPriceSource;
}

export type ChipTone = "ok" | "idle" | "skip" | "fail";

/** Status pill with an icon + text (never colour alone). */
export function PriceChip({
  tone,
  children,
}: {
  tone: ChipTone;
  children: ReactNode;
}) {
  const Icon = {
    ok: CircleCheck,
    idle: CircleDashed,
    skip: CircleMinus,
    fail: CircleX,
  }[tone];
  return (
    <span className="ivp-chip" data-tone={tone}>
      <Icon aria-hidden="true" />
      {children}
    </span>
  );
}

/** Price field with a leading currency mark; blank = keep the old price. */
function PriceInput({
  label,
  mark,
  value,
  disabled,
  onChange,
}: {
  label: string;
  mark: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="ivp-adorn">
      <span className="ivp-adorn-mark" aria-hidden="true">
        {mark}
      </span>
      <input
        className="input mono"
        aria-label={label}
        inputMode="decimal"
        enterKeyHint="next"
        autoComplete="off"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(formatMoneyTyping(e.target.value, 8, false))}
      />
    </div>
  );
}

/** "IDX · Saham", "NASDAQ · Saham", or the market's own name ("Reksa dana Indonesia"). */
export function marketLine(
  holding: InvestmentDto,
  typeLabel: string,
  missing: string,
) {
  if (!holding.market) return `${missing} · ${typeLabel}`;
  const market = MARKETS[holding.market as keyof typeof MARKETS];
  if (!market) return typeLabel;
  return /^[A-Z]{2,7}$/.test(market.key)
    ? `${market.key} · ${typeLabel}`
    : market.label;
}

/** Coloured type glyph + ticker/name/market block shared by table and preview. */
export function InstrumentCell({
  holding,
  marketLabel,
}: {
  holding: InvestmentDto;
  marketLabel: string;
}) {
  const Icon = TYPE_ICONS[holding.type as keyof typeof TYPE_ICONS];
  return (
    <div className="ivp-inst">
      <span className="ivp-mark" data-type={holding.type} aria-hidden="true">
        {Icon ? <Icon /> : holding.ticker.slice(0, 3)}
      </span>
      <span className="ivp-inst-text">
        <strong>{holding.ticker || holding.name}</strong>
        <span>{holding.name}</span>
        <small>{marketLabel}</small>
      </span>
    </div>
  );
}

export function formatPrice(
  holding: InvestmentDto,
  value: string,
  currency: string,
  locale: string,
  hidden: boolean,
) {
  if (percentPrice(holding)) return hidden ? "••••" : `${value}%`;
  return money(value, currency, locale, hidden, 8);
}

export function priceDate(price: InvestmentValuationPriceDto, locale: string) {
  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
    dateStyle: "medium",
    timeZone: "Asia/Jakarta",
    ...(price.hasTime ? { timeStyle: "short" as const } : {}),
  }).format(new Date(price.asOf));
}

/** Stored price with its own date, source and a stale marker (spec §10). */
function PreviousPrice({
  holding,
  valuation,
  copy,
}: {
  holding: InvestmentDto;
  valuation: InvestmentValuationDto | undefined;
  copy: PriceCopy;
}) {
  const { locale } = useLocale();
  const { hideBalance } = useMoney();
  const price = valuation?.price;
  if (!price) return <span className="ivp-muted">{copy.noPrice}</span>;
  return (
    <div className="ivp-prev">
      <strong className="ivp-num">
        {formatPrice(holding, price.value, price.currency, locale, hideBalance)}
      </strong>
      <small>
        {priceDate(price, locale)} · {price.source}
      </small>
      {price.stale && (
        <span className="ivp-stale">
          <Clock3 aria-hidden="true" />
          {copy.stale(price.ageDays)}
        </span>
      )}
    </div>
  );
}

function manualStatus(
  entry: PriceEntry,
  row: InvestmentPriceBatchResultDto["rows"][number] | undefined,
  saved: boolean,
  copy: PriceCopy,
  locale: string,
): { tone: ChipTone; label: string; note?: string } {
  if (row) {
    const note = row.code
      ? locale === "id"
        ? (row.message ?? undefined)
        : row.code.replaceAll("_", " ")
      : undefined;
    if (row.status === "updated")
      return { tone: "ok", label: saved ? copy.saved : copy.willUpdate };
    if (row.status === "failed")
      return { tone: "fail", label: copy.failed, note };
    return { tone: "skip", label: copy.skipped, note };
  }
  return entry.price.trim()
    ? { tone: "ok", label: copy.ready }
    : { tone: "idle", label: copy.empty };
}

function feedStatus(
  holding: InvestmentDto,
  feed: FeedResult | undefined,
  copy: PriceCopy,
): { tone: ChipTone; label: string; note?: string } {
  const auto =
    (holding.type === "saham" || holding.type === "kripto") &&
    !holding.details?.manualInstrument;
  if (!auto)
    return { tone: "skip", label: copy.skipped, note: copy.feedManual };
  if (!feed) return { tone: "idle", label: "—" };
  if (feed.status === "updated")
    return { tone: "ok", label: copy.saved, note: copy.feedOk };
  const state = feed.feed?.state;
  if (state === "simulated")
    return { tone: "skip", label: copy.skipped, note: copy.feedSimulated };
  if (state === "no_route")
    return { tone: "fail", label: copy.failed, note: copy.feedNoRoute };
  if (state === "failed" || feed.status === "failed")
    return {
      tone: "fail",
      label: copy.failed,
      note: feed.feed?.error
        ? `${copy.feedFailed}: ${feed.feed.error}`
        : copy.feedFailed,
    };
  return { tone: "skip", label: copy.skipped, note: copy.feedUnchanged };
}

/**
 * One table for both tabs. Below 720px the rows reflow into cards (CSS,
 * price-update.css) so there is exactly one price input per holding.
 */
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
  const copy = priceCopy(locale);
  if (!holdings.length) return <p className="ivp-muted">{p.noRows}</p>;
  return (
    <div className="ivp-table-wrap">
      <table className="ivp-table" data-mode={mode}>
        <thead>
          <tr>
            <th scope="col">{copy.instrument}</th>
            <th scope="col">{copy.unit}</th>
            <th scope="col">
              {mode === "manual" ? p.previous : copy.storedPrice}
            </th>
            {mode === "manual" && (
              <>
                <th scope="col">{p.next}</th>
                <th scope="col">{p.source}</th>
              </>
            )}
            <th scope="col">{mode === "manual" ? p.status : copy.result}</th>
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
            const status =
              mode === "manual"
                ? manualStatus(entry, row, !!result?.saved, copy, locale)
                : feedStatus(h, feed, copy);
            const marketLabel = marketLine(h, c[h.type], c.completeMarket);
            return (
              <tr key={h.id} data-status={status.tone}>
                <td data-cell="instrument">
                  <InstrumentCell holding={h} marketLabel={marketLabel} />
                </td>
                <td data-label={copy.unit} data-cell="unit">
                  {percentPrice(h)
                    ? priceUnit(h)
                    : `${h.currency === "IDR" ? "Rp" : h.currency} ${priceUnit(h)}`}
                </td>
                <td
                  data-label={mode === "manual" ? p.previous : copy.storedPrice}
                  data-cell="previous"
                >
                  <PreviousPrice holding={h} valuation={v} copy={copy} />
                </td>
                {mode === "manual" && (
                  <>
                    <td data-label={p.next} data-cell="next">
                      <PriceInput
                        label={`${p.next}: ${h.name}`}
                        mark={percentPrice(h) ? "%" : currencyMark(h.currency)}
                        value={entry.price}
                        disabled={disabled}
                        onChange={(price) =>
                          onChange(h.id, { ...entry, price })
                        }
                      />
                    </td>
                    <td data-label={p.source} data-cell="source">
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
                <td
                  data-label={mode === "manual" ? p.status : copy.result}
                  data-cell="status"
                >
                  <span role="status">
                    <PriceChip tone={status.tone}>{status.label}</PriceChip>
                  </span>
                  {status.note && <small>{status.note}</small>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
