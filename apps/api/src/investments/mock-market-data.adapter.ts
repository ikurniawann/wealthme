import { Injectable } from "@nestjs/common";

import type { MarketDataPort, MarketDataQuote } from "./market-data.port";
import type { InvestmentType } from "@prisma/client";

function hashTicker(ticker: string): number {
  let hash = 0;
  for (let i = 0; i < ticker.length; i++) {
    hash = (hash * 31 + ticker.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function deterministicBasePrice(ticker: string): number {
  const hash = hashTicker(ticker);
  // Base price between 500 and 100,000
  return 500 + (hash % 99_501);
}

@Injectable()
export class MockMarketDataAdapter implements MarketDataPort {
  async getPrice(
    ticker: string,
    _type: InvestmentType,
  ): Promise<MarketDataQuote> {
    // No `Math.random()` jitter. `PriceRefreshScheduler` re-quotes every
    // instrument once a minute, so a ±2% wobble per call meant a dev or demo
    // instance (anything without USE_REAL_MARKET_DATA=true) redrew a
    // different portfolio value — and therefore a different net worth,
    // "Total Aset" and allocation split — every 60 seconds while the user did
    // nothing. Same reasoning that removed the `Math.random()` receipt-scan
    // amounts (see ocr.factory.ts): a fabricated number that MOVES is worse
    // than a fabricated number that holds still, because only the moving one
    // looks like the ledger is broken.
    const price = deterministicBasePrice(ticker);
    return {
      price,
      source: "mock",
      asOf: new Date(),
      delayed: false,
      currency: "IDR",
    };
  }
}
