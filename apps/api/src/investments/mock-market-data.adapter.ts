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
    const base = deterministicBasePrice(ticker);
    const fluctuation = (Math.random() - 0.5) * 0.04; // ±2%
    const price = Math.round(base * (1 + fluctuation) * 100) / 100;
    return { price, source: "mock", asOf: new Date(), delayed: false };
  }
}
