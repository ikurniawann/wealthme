import {
  ExternalRequestTimeoutError,
  fetchWithTimeout,
  isAbortTimeoutError,
  withTimeout,
} from "./external-fetch.util";

describe("isAbortTimeoutError", () => {
  it("recognizes a TimeoutError DOMException", () => {
    const err = new DOMException("timed out", "TimeoutError");
    expect(isAbortTimeoutError(err)).toBe(true);
  });

  it("recognizes an AbortError", () => {
    const err = new DOMException("aborted", "AbortError");
    expect(isAbortTimeoutError(err)).toBe(true);
  });

  it("returns false for an unrelated error", () => {
    expect(isAbortTimeoutError(new Error("network down"))).toBe(false);
    expect(isAbortTimeoutError("not an error")).toBe(false);
  });
});

describe("fetchWithTimeout", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("resolves normally when the underlying fetch succeeds within the bound", async () => {
    const okResponse = new Response("{}", { status: 200 });
    global.fetch = jest.fn().mockResolvedValue(okResponse);

    const res = await fetchWithTimeout(
      "https://example.test",
      {},
      5000,
      "test call",
    );

    expect(res).toBe(okResponse);
  });

  it("throws ExternalRequestTimeoutError (not the raw DOMException) when fetch aborts on timeout", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new DOMException("timed out", "TimeoutError"));

    await expect(
      fetchWithTimeout("https://example.test", {}, 5000, "CoinGecko request"),
    ).rejects.toThrow(ExternalRequestTimeoutError);
  });

  it("rethrows a non-timeout fetch failure unchanged", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("DNS failure"));

    await expect(
      fetchWithTimeout("https://example.test", {}, 5000, "test call"),
    ).rejects.toThrow("DNS failure");
  });
});

describe("withTimeout", () => {
  it("resolves with the underlying value when it settles before the bound", async () => {
    await expect(
      withTimeout(Promise.resolve("done"), 5000, "yahoo quote"),
    ).resolves.toBe("done");
  });

  it("rejects with ExternalRequestTimeoutError when the promise never settles in time", async () => {
    const neverSettles = new Promise<string>(() => {
      // deliberately never resolves — simulates a hung upstream call
    });

    await expect(withTimeout(neverSettles, 10, "yahoo quote")).rejects.toThrow(
      ExternalRequestTimeoutError,
    );
  });

  it("propagates a rejection from the underlying promise unchanged", async () => {
    await expect(
      withTimeout(Promise.reject(new Error("boom")), 5000, "yahoo quote"),
    ).rejects.toThrow("boom");
  });
});
