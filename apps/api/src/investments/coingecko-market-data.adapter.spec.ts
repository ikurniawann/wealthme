import { ExternalRequestTimeoutError } from "../common/utils/external-fetch.util";

import {
  CoinGeckoMarketDataAdapter,
  toCoinGeckoId,
  UnmappedTickerError,
} from "./coingecko-market-data.adapter";

describe("toCoinGeckoId", () => {
  it("maps common ticker symbols to CoinGecko ids", () => {
    expect(toCoinGeckoId("BTC")).toBe("bitcoin");
    expect(toCoinGeckoId("eth")).toBe("ethereum");
  });

  it("returns undefined for an unmapped ticker rather than guessing", () => {
    expect(toCoinGeckoId("NOT_A_REAL_COIN")).toBeUndefined();
  });
});

// EPIC-023 Task G retry (HIGH five-reviewer finding) — `getPrice` itself had
// no test coverage at all (only the pure `toCoinGeckoId` helper was
// tested), despite doing an unvalidated `as` cast on the live HTTP
// response. These prove the zod-validated parsing path, the timeout bound,
// and the zero-price rejection.
describe("CoinGeckoMarketDataAdapter.getPrice", () => {
  const originalFetch = global.fetch;
  let adapter: CoinGeckoMarketDataAdapter;

  beforeEach(() => {
    adapter = new CoinGeckoMarketDataAdapter();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("parses a well-formed response into a MarketDataQuote", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          bitcoin: { idr: 950_000_000, last_updated_at: 1_700_000_000 },
        }),
        { status: 200 },
      ),
    );

    const quote = await adapter.getPrice("BTC", "kripto");

    expect(quote.price).toBe(950_000_000);
    expect(quote.source).toBe("coingecko");
    expect(quote.delayed).toBe(false);
    expect(quote.asOf).toEqual(new Date(1_700_000_000 * 1000));
  });

  it("throws for a ticker with no CoinGecko mapping, without making a request", async () => {
    global.fetch = jest.fn();

    await expect(
      adapter.getPrice("NOT_A_REAL_COIN", "kripto"),
    ).rejects.toThrow();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // EPIC-024 C1 (D8) — an unmapped ticker must be DISTINGUISHABLE from a
  // transient failure (timeout, bad HTTP status, bad shape) so
  // InvestmentsService can treat it as a permanent "fall back to manual
  // pricing" state instead of a retryable error. This adapter call alone
  // must never throw out of the process — it's caught one layer up in
  // InvestmentsService.findAll (see investments.service.spec.ts).
  it("throws UnmappedTickerError specifically (not a generic Error) for an unmapped ticker", async () => {
    global.fetch = jest.fn();

    await expect(
      adapter.getPrice("NOT_A_REAL_COIN", "kripto"),
    ).rejects.toBeInstanceOf(UnmappedTickerError);
  });

  it("does NOT throw UnmappedTickerError for a mapped ticker that fails for another reason", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response("", { status: 503 }));

    const err = await adapter
      .getPrice("BTC", "kripto")
      .catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(UnmappedTickerError);
  });

  it("throws when the HTTP response is not ok", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response("", { status: 503 }));

    await expect(adapter.getPrice("BTC", "kripto")).rejects.toThrow();
  });

  it("throws when the response body is not valid JSON", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response("not json", { status: 200 }));

    await expect(adapter.getPrice("BTC", "kripto")).rejects.toThrow();
  });

  it("throws when the response shape does not match the CoinGecko schema", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ bitcoin: { idr: "not-a-number" } }), {
        status: 200,
      }),
    );

    await expect(adapter.getPrice("BTC", "kripto")).rejects.toThrow();
  });

  it("treats a zero price as unavailable rather than a valid quote", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ bitcoin: { idr: 0 } }), { status: 200 }),
      );

    await expect(adapter.getPrice("BTC", "kripto")).rejects.toThrow();
  });

  it("surfaces a timeout as ExternalRequestTimeoutError rather than hanging", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new DOMException("timed out", "TimeoutError"));

    await expect(adapter.getPrice("BTC", "kripto")).rejects.toThrow(
      ExternalRequestTimeoutError,
    );
  });
});
