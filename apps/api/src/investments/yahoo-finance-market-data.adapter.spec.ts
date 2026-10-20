import { ExternalRequestTimeoutError } from "../common/utils/external-fetch.util";

import {
  toIdxTicker,
  toYahooSymbol,
  YahooFinanceMarketDataAdapter,
} from "./yahoo-finance-market-data.adapter";

describe("toIdxTicker", () => {
  it("appends .JK to a plain ticker", () => {
    expect(toIdxTicker("bbca")).toBe("BBCA.JK");
  });

  it("does not double-append .JK when already present", () => {
    expect(toIdxTicker("BBCA.JK")).toBe("BBCA.JK");
    expect(toIdxTicker("bbca.jk")).toBe("BBCA.JK");
  });
});

// EPIC-023 Task G retry (HIGH five-reviewer finding) — a hung call must
// still time out at this adapter's boundary instead of hanging
// InvestmentsService.findAll's Promise.all indefinitely. The adapter
// accepts an overridable timeout (constructed directly via `new`, never
// through NestJS DI) so this test doesn't need to wait out the real 10s
// production bound.
describe("YahooFinanceMarketDataAdapter.getPrice — timeout bound", () => {
  it("surfaces ExternalRequestTimeoutError instead of hanging forever", async () => {
    const adapter = new YahooFinanceMarketDataAdapter(10);

    const yahooFinance2 = await import("yahoo-finance2");
    const spy = jest
      .spyOn(yahooFinance2.default.prototype, "quote")
      .mockImplementation(() => new Promise<never>(() => {}));

    try {
      await expect(adapter.getPrice("BBCA", "saham")).rejects.toThrow(
        ExternalRequestTimeoutError,
      );
    } finally {
      spy.mockRestore();
    }
  });

  // EPIC-023 Task G retry (MEDIUM five-reviewer finding, round 2) —
  // yahoo-finance2's `.quote()` DOES accept per-call fetch options (its 3rd
  // argument's `fetchOptions`, merged straight into the underlying
  // `fetch()`) — a prior retry's comment claiming otherwise was wrong. A
  // generic Promise-race timeout alone bounds the CALLER but leaves the
  // real HTTP request running in the background; this locks in that a real
  // `AbortSignal` is actually passed through so the request itself gets
  // cancelled, not just our wait on it.
  it("passes a real AbortSignal into yf.quote()'s own fetchOptions, not just a Promise-race timeout", async () => {
    const adapter = new YahooFinanceMarketDataAdapter(5_000);

    const yahooFinance2 = await import("yahoo-finance2");
    const spy = jest
      .spyOn(yahooFinance2.default.prototype, "quote")
      .mockResolvedValue({
        regularMarketPrice: 1000,
        regularMarketTime: new Date(),
      } as never);

    try {
      await adapter.getPrice("BBCA", "saham");

      expect(spy).toHaveBeenCalledTimes(1);
      const [, , moduleOptions] = spy.mock.calls[0] as [
        string,
        unknown,
        { fetchOptions?: { signal?: unknown } } | undefined,
      ];
      expect(moduleOptions?.fetchOptions?.signal).toBeInstanceOf(AbortSignal);
    } finally {
      spy.mockRestore();
    }
  });
});

// Client report 2026-10-21 — "Price fetch failed for TSLA: Market data error
// for $": the free-text price symbol was sent to Yahoo verbatim.
describe("toYahooSymbol — typed price symbols", () => {
  const us = (priceSymbol: string | null) =>
    toYahooSymbol("TSLA", { market: "NASDAQ", priceSymbol, currency: "USD" });

  it("ignores a lone $ and falls back to the US ticker", () => {
    expect(us("$")).toBe("TSLA");
    expect(us("  ")).toBe("TSLA");
  });

  it("unwraps a cashtag and keeps a valid explicit symbol", () => {
    expect(us("$tsla")).toBe("TSLA");
    expect(us("BRK-B")).toBe("BRK-B");
  });

  it("routes by market when no symbol is typed", () => {
    expect(us(null)).toBe("TSLA");
    expect(
      toYahooSymbol("$TSLA", {
        market: "NYSE",
        priceSymbol: null,
        currency: "USD",
      }),
    ).toBe("TSLA");
    expect(
      toYahooSymbol("bbca", {
        market: "IDX",
        priceSymbol: "$",
        currency: "IDR",
      }),
    ).toBe("BBCA.JK");
  });
});
