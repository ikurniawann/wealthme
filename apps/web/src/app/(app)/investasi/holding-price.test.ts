import { hasLiveFeedPrice, hasMarketPrice } from "./holding-price";

type Fields = Parameters<typeof hasMarketPrice>[0];

const base: Fields = {
  type: "saham",
  currentPrice: "9000",
  latestPriceSource: "yahoo-finance",
  automatedPriceSimulated: false,
  automatedPriceUnmapped: false,
};

describe("hasMarketPrice", () => {
  it("is true for a feed-priced holding and for deposito", () => {
    expect(hasMarketPrice(base)).toBe(true);
    expect(
      hasMarketPrice({ ...base, type: "deposito", currentPrice: null }),
    ).toBe(true);
  });

  it("is false when the price is simulated or missing", () => {
    expect(hasMarketPrice({ ...base, automatedPriceSimulated: true })).toBe(
      false,
    );
    expect(hasMarketPrice({ ...base, currentPrice: null })).toBe(false);
  });

  it("is false for emas valued only at its cost basis", () => {
    const emas: Fields = { ...base, type: "emas", latestPriceSource: null };
    expect(hasMarketPrice(emas)).toBe(false);
    expect(hasMarketPrice({ ...emas, latestPriceSource: "manual" })).toBe(true);
  });
});

describe("hasLiveFeedPrice", () => {
  it("counts only saham/kripto quoted by a feed", () => {
    expect(hasLiveFeedPrice(base)).toBe(true);
    expect(
      hasLiveFeedPrice({
        ...base,
        type: "kripto",
        latestPriceSource: "coingecko",
      }),
    ).toBe(true);
    expect(hasLiveFeedPrice({ ...base, currentPrice: null })).toBe(false);
    expect(hasLiveFeedPrice({ ...base, automatedPriceUnmapped: true })).toBe(
      false,
    );
    expect(hasLiveFeedPrice({ ...base, latestPriceSource: "manual" })).toBe(
      false,
    );
    expect(hasLiveFeedPrice({ ...base, type: "reksa_dana" })).toBe(false);
  });
});
