export interface MarketDataPort {
  getPrice(ticker: string): Promise<{ price: number; source: string }>;
}

export const MARKET_DATA_PORT = "MARKET_DATA_PORT";
