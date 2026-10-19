import { Injectable } from "@nestjs/common";

import { type CoinGeckoMarketDataAdapter } from "./coingecko-market-data.adapter";
import { type YahooFinanceMarketDataAdapter } from "./yahoo-finance-market-data.adapter";

import type {
  MarketDataPort,
  MarketDataQuote,
  MarketDataRequest,
} from "./market-data.port";
import type { InvestmentType } from "@prisma/client";

/**
 * EPIC-023 G1 (D15) — "wire CoinGecko for crypto and confirm Yahoo `.JK` for
 * IDX equities behind the existing MarketDataPort". This adapter IS the
 * routing: `InvestmentsModule` binds this single adapter to MARKET_DATA_PORT
 * (in place of a single hardcoded provider), and it dispatches by
 * `InvestmentType` rather than the caller needing to know which feed to
 * use. Manual-only types (reksa_dana, obligasi, emas, lainnya) must never
 * reach this adapter — the service layer filters them out before calling
 * `getPrice` at all (see AUTOMATED_PRICE_TYPES) — but this still fails
 * loudly rather than silently fabricating a quote if that invariant is ever
 * violated.
 */
@Injectable()
export class RoutedMarketDataAdapter implements MarketDataPort {
  constructor(
    private readonly coinGecko: CoinGeckoMarketDataAdapter,
    private readonly yahoo: YahooFinanceMarketDataAdapter,
  ) {}

  async getPrice(
    ticker: string,
    type: InvestmentType,
    request?: MarketDataRequest,
  ): Promise<MarketDataQuote> {
    switch (type) {
      case "kripto":
        return this.coinGecko.getPrice(ticker, type, request);
      case "saham":
        return this.yahoo.getPrice(ticker, type, request);
      default:
        throw new Error(
          `"${type}" is a manual-only instrument type — it must never reach MarketDataPort.getPrice`,
        );
    }
  }
}
