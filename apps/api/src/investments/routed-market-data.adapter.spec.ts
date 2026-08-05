import { RoutedMarketDataAdapter } from "./routed-market-data.adapter";

describe("RoutedMarketDataAdapter", () => {
  function makeAdapter() {
    const coinGecko = { getPrice: jest.fn() };
    const yahoo = { getPrice: jest.fn() };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new RoutedMarketDataAdapter(coinGecko as any, yahoo as any);
    return { adapter, coinGecko, yahoo };
  }

  it("routes 'kripto' to the CoinGecko adapter", async () => {
    const { adapter, coinGecko, yahoo } = makeAdapter();
    coinGecko.getPrice.mockResolvedValue({
      price: 1,
      source: "coingecko",
      asOf: new Date(),
      delayed: false,
    });

    await adapter.getPrice("BTC", "kripto");

    expect(coinGecko.getPrice).toHaveBeenCalledWith("BTC", "kripto");
    expect(yahoo.getPrice).not.toHaveBeenCalled();
  });

  it("routes 'saham' to the Yahoo adapter", async () => {
    const { adapter, coinGecko, yahoo } = makeAdapter();
    yahoo.getPrice.mockResolvedValue({
      price: 1,
      source: "yahoo-finance",
      asOf: new Date(),
      delayed: true,
    });

    await adapter.getPrice("BBCA", "saham");

    expect(yahoo.getPrice).toHaveBeenCalledWith("BBCA", "saham");
    expect(coinGecko.getPrice).not.toHaveBeenCalled();
  });

  it("throws for a manual-only type rather than silently fabricating a quote", async () => {
    const { adapter } = makeAdapter();
    await expect(adapter.getPrice("RD1", "reksa_dana")).rejects.toThrow();
  });
});
