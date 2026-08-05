import { Injectable } from "@nestjs/common";
import { z } from "zod";

import {
  ExternalRequestTimeoutError,
  fetchWithTimeout,
} from "../common/utils/external-fetch.util";

import type { MarketDataPort, MarketDataQuote } from "./market-data.port";
import type { InvestmentType } from "@prisma/client";

const COINGECKO_API_BASE = "https://api.coingecko.com/api/v3";
const VS_CURRENCY = "idr";
// EPIC-023 Task G retry (HIGH five-reviewer finding) — a hung CoinGecko
// connection must not hang InvestmentsService.findAll's Promise.all
// indefinitely for every holding in the request.
const COINGECKO_TIMEOUT_MS = 10_000;

/**
 * EPIC-023 G1 (D15) — CoinGecko's `/simple/price` uses their internal coin
 * ids, not ticker symbols (e.g. "bitcoin", not "BTC"). This maps the common
 * tickers a family is likely to hold; an unmapped ticker fails loudly
 * (BadRequestException-shaped Error) rather than silently returning a mock
 * price — matching the Yahoo adapter's "throw, never fabricate" behaviour.
 */
const TICKER_TO_COINGECKO_ID: Readonly<Record<string, string>> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  USDT: "tether",
  BNB: "binancecoin",
  SOL: "solana",
  USDC: "usd-coin",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  TRX: "tron",
  TON: "the-open-network",
  DOT: "polkadot",
  MATIC: "matic-network",
  LTC: "litecoin",
  AVAX: "avalanche-2",
};

export function toCoinGeckoId(ticker: string): string | undefined {
  return TICKER_TO_COINGECKO_ID[ticker.toUpperCase()];
}

// EPIC-023 Task G retry (HIGH five-reviewer finding) — the previous shape
// was a hand-written TypeScript type with a bare `as` cast on `res.json()`,
// with no runtime check that CoinGecko's actual response matches it. Since
// this adapter's shape comes from trained knowledge rather than live docs
// (per the implementer's own note), an unvalidated cast is worse than
// usual — validate at the boundary instead.
const simplePriceEntrySchema = z
  .object({ last_updated_at: z.number().optional() })
  .catchall(z.number().optional());
const simplePriceResponseSchema = z.record(z.string(), simplePriceEntrySchema);

/**
 * EPIC-023 G1 (D15) — crypto pricing via CoinGecko's public `/simple/price`
 * endpoint (no API key required for the free tier). Not labelled "delayed"
 * per D15 — only the Yahoo `.JK` IDX feed carries that label — but the
 * quote is still only as fresh as CoinGecko's cache (`last_updated_at`,
 * surfaced as `asOf` so the UI never implies a live tick that isn't there).
 */
@Injectable()
export class CoinGeckoMarketDataAdapter implements MarketDataPort {
  async getPrice(
    ticker: string,
    _type: InvestmentType,
  ): Promise<MarketDataQuote> {
    const coinId = toCoinGeckoId(ticker);
    if (!coinId) {
      throw new Error(
        `No CoinGecko mapping for ticker "${ticker}" — add it to TICKER_TO_COINGECKO_ID or enter the price manually.`,
      );
    }

    const url = `${COINGECKO_API_BASE}/simple/price?ids=${encodeURIComponent(
      coinId,
    )}&vs_currencies=${VS_CURRENCY}&include_last_updated_at=true`;

    let res: Response;
    try {
      res = await fetchWithTimeout(
        url,
        {},
        COINGECKO_TIMEOUT_MS,
        `CoinGecko request for ${ticker}`,
      );
    } catch (err: unknown) {
      // A timeout is distinguishable (ExternalRequestTimeoutError) — rethrow
      // it as-is rather than flattening it into a generic Error.
      if (err instanceof ExternalRequestTimeoutError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`CoinGecko request failed for ${ticker}: ${msg}`);
    }

    if (!res.ok) {
      throw new Error(
        `CoinGecko returned ${res.status} for ${ticker} (${coinId})`,
      );
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new Error(
        `CoinGecko returned a non-JSON response for ${ticker} (${coinId})`,
      );
    }

    const parsed = simplePriceResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new Error(
        `CoinGecko returned an unexpected response shape for ${ticker} (${coinId})`,
      );
    }

    const entry = parsed.data[coinId];
    const price = entry?.[VS_CURRENCY];
    // A zero (or negative) price is never a real quote — treat it the same
    // as "unavailable" rather than recording a bogus Rp 0 holding value.
    if (price === undefined || price === null || price <= 0) {
      throw new Error(`CoinGecko price unavailable for ${ticker} (${coinId})`);
    }

    return {
      price,
      source: "coingecko",
      asOf: entry?.last_updated_at
        ? new Date(entry.last_updated_at * 1000)
        : new Date(),
      delayed: false,
    };
  }
}
