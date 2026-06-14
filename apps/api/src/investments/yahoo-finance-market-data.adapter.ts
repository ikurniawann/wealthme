import { Injectable } from "@nestjs/common";
import YahooFinance from "yahoo-finance2";

import type { MarketDataPort } from "./market-data.port";

const yf = new YahooFinance();

@Injectable()
export class YahooFinanceMarketDataAdapter implements MarketDataPort {
  async getPrice(ticker: string): Promise<{ price: number; source: string }> {
    try {
      const quote = await yf.quote(ticker);
      const price = quote.regularMarketPrice;
      if (price === undefined || price === null) {
        throw new Error(`Market price unavailable for ${ticker}`);
      }
      return { price, source: "yahoo-finance" };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Market data error for ${ticker}: ${msg}`);
    }
  }
}
