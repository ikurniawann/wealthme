import { FrankfurterClient } from "./frankfurter.client";

const LIVE_BODY = {
  amount: 1.0,
  base: "EUR",
  date: "2026-09-25",
  rates: {
    AUD: 1.622,
    CNY: 7.6551,
    IDR: 20427.22,
    JPY: 179.7,
    SGD: 1.4563,
    USD: 1.1403,
    GBP: 0.861,
    HKD: 8.97,
    MYR: 4.98,
    THB: 38.1,
    PHP: 65.7,
    KRW: 1562.4,
    INR: 95.6,
  },
};

function fakeFetch(status: number, body: unknown) {
  return jest.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

describe("FrankfurterClient — revisi I", () => {
  it("requests EUR-based rates once and derives IDR per unit for every code", async () => {
    const fetchImpl = fakeFetch(200, LIVE_BODY);
    const result = await new FrankfurterClient(fetchImpl, 5_000).fetchLatest();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(
      "https://api.frankfurter.dev/v1/latest?base=EUR&symbols=IDR,USD,SGD,JPY,AUD,CNY,GBP,HKD,MYR,THB,PHP,KRW,INR",
    );
    expect(fetchImpl.mock.calls[0][2]).toBe(5_000);
    expect(result).toEqual({
      rateDate: "2026-09-25",
      idrPerUnit: {
        IDR: "1.000000",
        EUR: "20427.220000",
        USD: "17913.899851",
        SGD: "14026.793930",
        JPY: "113.674012",
        AUD: "12593.847102",
        CNY: "2668.445873",
        GBP: "23724.994193",
        HKD: "2277.282051",
        MYR: "4101.851406",
        THB: "536.147507",
        PHP: "310.916591",
        KRW: "13.074258",
        INR: "213.673849",
      },
    });
  });

  it("throws on a non-2xx response", async () => {
    await expect(
      new FrankfurterClient(fakeFetch(503, {}), 5_000).fetchLatest(),
    ).rejects.toThrow("Frankfurter FX responded 503");
  });

  it("throws when a currency is missing from the payload", async () => {
    const { USD: _drop, ...rates } = LIVE_BODY.rates;
    await expect(
      new FrankfurterClient(
        fakeFetch(200, { ...LIVE_BODY, rates }),
        5_000,
      ).fetchLatest(),
    ).rejects.toThrow();
  });

  it("throws when the base is not EUR (payload shape changed)", async () => {
    await expect(
      new FrankfurterClient(
        fakeFetch(200, { ...LIVE_BODY, base: "USD" }),
        5_000,
      ).fetchLatest(),
    ).rejects.toThrow();
  });
});
