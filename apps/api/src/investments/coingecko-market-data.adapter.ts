import { Injectable } from "@nestjs/common";
import { z } from "zod";

import {
  ExternalRequestTimeoutError,
  fetchWithTimeout,
} from "../common/utils/external-fetch.util";

import type {
  MarketDataPort,
  MarketDataQuote,
  MarketDataRequest,
} from "./market-data.port";
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
 * tickers a family is likely to hold.
 *
 * EPIC-024 C1 (D8) — widened from 15 to cover the broader top-cap/most-held
 * set. An unmapped ticker throws `UnmappedTickerError` (a distinguishable
 * subclass, not a generic Error) so callers — `InvestmentsService.findAll`
 * — can tell "this ticker will never resolve automatically, fall back to
 * manual pricing" apart from a transient network/API failure, instead of
 * retry-alerting on every request forever. It still never silently
 * fabricates a price, matching the Yahoo adapter's "throw, never fabricate"
 * behaviour.
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
  // EPIC-024 C1 (D8) additions.
  SHIB: "shiba-inu",
  LINK: "chainlink",
  UNI: "uniswap",
  ATOM: "cosmos",
  ETC: "ethereum-classic",
  XLM: "stellar",
  BCH: "bitcoin-cash",
  NEAR: "near",
  APT: "aptos",
  ARB: "arbitrum",
  OP: "optimism",
  ICP: "internet-computer",
  FIL: "filecoin",
  SUI: "sui",
  PEPE: "pepe",
  AAVE: "aave",
  MKR: "maker",
  XMR: "monero",
  ALGO: "algorand",
  VET: "vechain",
  // Client report 2026-10-21 ("CoinGecko price unavailable for HBR (hbar)")
  // — widened again with coins sold by Indonesian exchanges. Ids verified
  // against CoinGecko's coin pages; a coin whose id is not the obvious
  // lowercase name is exactly the case this map exists for.
  HBAR: "hedera-hashgraph",
  POL: "polygon-ecosystem-token",
  DAI: "dai",
  WBTC: "wrapped-bitcoin",
  CRO: "crypto-com-chain",
  KAS: "kaspa",
  FTM: "fantom",
  INJ: "injective-protocol",
  RENDER: "render-token",
  WLD: "worldcoin-wld",
  SEI: "sei-network",
  TIA: "celestia",
  STX: "blockstack",
  IMX: "immutable-x",
  GRT: "the-graph",
  SAND: "the-sandbox",
  MANA: "decentraland",
  AXS: "axie-infinity",
  APE: "apecoin",
  GALA: "gala",
  CHZ: "chiliz",
  LDO: "lido-dao",
  QNT: "quant-network",
  RUNE: "thorchain",
  CAKE: "pancakeswap-token",
  EGLD: "elrond-erd-2",
  SNX: "havven",
  CRV: "curve-dao-token",
  EOS: "eos",
  XTZ: "tezos",
  THETA: "theta-token",
  FLOW: "flow",
  ZEC: "zcash",
  BONK: "bonk",
  WIF: "dogwifcoin",
  FLOKI: "floki",
  JUP: "jupiter-exchange-solana",
  TAO: "bittensor",
  ENA: "ethena",
  ONDO: "ondo-finance",
  STRK: "starknet",
  HYPE: "hyperliquid",
  TRUMP: "official-trump",
  PAXG: "pax-gold",
  XAUT: "tether-gold",
  IDRT: "rupiah-token",
};

/** "$HBAR", "hbar-usd", " HBAR/IDR " → "HBAR": the symbol people type. */
function bareSymbol(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/^\$/, "")
    .replace(/[-/](USD|USDT|IDR)$/, "");
}

export function toCoinGeckoId(ticker: string): string | undefined {
  return TICKER_TO_COINGECKO_ID[bareSymbol(ticker)];
}

/**
 * The CoinGecko id for a holding. An explicit `priceSymbol` is the id
 * ("bitcoin") — unless it is a ticker we map: people type "HBAR" (or
 * "hbar") there, and "hbar" is not a CoinGecko id, so the price never
 * resolved. Otherwise the ticker map.
 */
export function resolveCoinGeckoId(
  ticker: string,
  priceSymbol: string | null | undefined,
): string | undefined {
  const explicit = priceSymbol?.trim();
  if (explicit) {
    const mapped = toCoinGeckoId(explicit);
    if (mapped) return mapped;
    const id = explicit.toLowerCase();
    if (/^[a-z0-9-]{1,64}$/.test(id)) return id;
  }
  return toCoinGeckoId(ticker);
}

/**
 * EPIC-024 C1 (D8) — thrown ONLY when a ticker has no CoinGecko id mapping.
 * Distinguishable from every other failure mode of this adapter (timeout,
 * non-2xx, bad shape, zero/negative price) so `InvestmentsService` can treat
 * it as a permanent "no automated source" state — surfaced to the UI as a
 * "harga manual" fallback — rather than a retryable transient error.
 */
export class UnmappedTickerError extends Error {
  constructor(public readonly ticker: string) {
    super(
      `No CoinGecko mapping for ticker "${ticker}" — add it to TICKER_TO_COINGECKO_ID or enter the price manually.`,
    );
    this.name = "UnmappedTickerError";
  }
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
    request?: MarketDataRequest,
  ): Promise<MarketDataQuote> {
    // Task 8 (R4) — an explicit priceSymbol is the CoinGecko coin id
    // ("bitcoin") or a mapped ticker; otherwise the ticker map.
    const coinId = resolveCoinGeckoId(ticker, request?.priceSymbol);
    if (!coinId) {
      throw new UnmappedTickerError(ticker);
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
      currency: VS_CURRENCY.toUpperCase(),
    };
  }
}
