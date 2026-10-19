import { Injectable } from "@nestjs/common";
import YahooFinance from "yahoo-finance2";

import {
  ExternalRequestTimeoutError,
  withTimeout,
} from "../common/utils/external-fetch.util";

import type {
  MarketDataPort,
  MarketDataQuote,
  MarketDataRequest,
} from "./market-data.port";
import type { InvestmentType } from "@prisma/client";

const yf = new YahooFinance();

/** Yahoo's IDX (Indonesia Stock Exchange) suffix — appended when missing so
 * a plain ticker like "BBCA" resolves to the Jakarta-listed quote rather
 * than colliding with an unrelated US-listed symbol of the same code. */
const IDX_SUFFIX = ".JK";

// EPIC-023 Task G retry (MEDIUM five-reviewer finding, round 2) —
// yahoo-finance2's `.quote()` DOES accept fetch options per-call (its 3rd
// argument, `moduleOptions.fetchOptions`, is merged straight into the
// underlying `fetch()` call — verified against the installed package's
// `yahooFinanceFetch.js`). A prior retry only wrapped the call in a generic
// Promise-level timeout (`withTimeout`), which bounds the CALLER but never
// cancels the underlying HTTP request — so a slow/hanging upstream left a
// dangling request running in the background on every timeout, and since a
// failed fetch writes no price row, the stale-price condition never
// cleared, compounding one dangling request per subsequent portfolio load.
// Passing a real `AbortSignal.timeout()` into `fetchOptions` closes that:
// the request itself is cancelled, not just our wait on it. `withTimeout`
// is kept alongside it (not removed) as a second, independent bound: it
// guarantees the caller is released via `ExternalRequestTimeoutError`
// even if some future yahoo-finance2 version stops honouring the signal.
const YAHOO_TIMEOUT_MS = 10_000;

export function toIdxTicker(ticker: string): string {
  return ticker.toUpperCase().endsWith(IDX_SUFFIX)
    ? ticker.toUpperCase()
    : `${ticker.toUpperCase()}${IDX_SUFFIX}`;
}

/**
 * Task 8 (R4) — the Yahoo symbol for a holding. An explicit `priceSymbol`
 * wins as typed. Otherwise by market: IDX → `TICKER.JK`; NASDAQ/NYSE →
 * plain `TICKER` (Yahoo serves US listings unsuffixed). A legacy row with no
 * market keeps `.JK` only when its currency is IDR — a USD holding is never
 * looked up on the Jakarta exchange again (the NVDA.JK bug).
 */
export function toYahooSymbol(
  ticker: string,
  request?: MarketDataRequest,
): string {
  const explicit = request?.priceSymbol?.trim();
  if (explicit) return explicit.toUpperCase();
  const market = request?.market ?? null;
  if (market === "NASDAQ" || market === "NYSE") return ticker.toUpperCase();
  if (market === null && request && request.currency !== "IDR") {
    return ticker.toUpperCase();
  }
  return toIdxTicker(ticker);
}

/**
 * EPIC-023 G1 (D15) — Yahoo equities (IDX `.JK` and, since Task 8, US
 * listings by plain symbol). Yahoo's free quote endpoint is
 * exchange-delayed (typically ~15-20 minutes for IDX) and not an official
 * exchange feed, so every quote from this adapter is labelled `delayed:
 * true` — the UI must render this as "delayed & unofficial", never as a
 * live price (see investasi/page.tsx).
 */
@Injectable()
export class YahooFinanceMarketDataAdapter implements MarketDataPort {
  // Overridable only for tests (constructed directly via `new` in
  // investments.module.ts, never through NestJS DI, so this stays a plain
  // constructor default rather than an injected config value).
  constructor(private readonly timeoutMs: number = YAHOO_TIMEOUT_MS) {}

  async getPrice(
    ticker: string,
    _type: InvestmentType,
    request?: MarketDataRequest,
  ): Promise<MarketDataQuote> {
    const symbol = toYahooSymbol(ticker, request);
    try {
      const quote = await withTimeout(
        yf.quote(symbol, undefined, {
          fetchOptions: { signal: AbortSignal.timeout(this.timeoutMs) },
        }),
        this.timeoutMs,
        `Yahoo Finance request for ${symbol}`,
      );
      const price = quote.regularMarketPrice;
      if (price === undefined || price === null) {
        throw new Error(`Market price unavailable for ${symbol}`);
      }
      return {
        price,
        source: "yahoo-finance",
        asOf: quote.regularMarketTime ?? new Date(),
        delayed: true,
        // Yahoo reports the listing currency; `.JK` quotes are IDR.
        currency: (
          quote.currency ?? (symbol.endsWith(IDX_SUFFIX) ? "IDR" : "USD")
        ).toUpperCase(),
      };
    } catch (err: unknown) {
      if (err instanceof ExternalRequestTimeoutError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Market data error for ${symbol}: ${msg}`);
    }
  }
}
