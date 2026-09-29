/**
 * Hardening audit (errors, HIGH) — `apiFetch` had no timeout, so a hung
 * backend/dead connection never resolved or rejected: every caller's
 * isSaving/isPending flag stayed true forever. These verify the default
 * 15s `AbortSignal.timeout()` wiring and that a real timeout surfaces a
 * distinct `code: "TIMEOUT"` instead of hanging or falling into a generic
 * error.
 */
import { apiFetch, type ApiError } from "./api-client";

// jsdom does not implement the global `Response` class; apiFetch only reads
// `.ok` / `.status` / `.json()` off whatever `fetch` resolves with.
function fakeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("apiFetch timeout", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test("passes an AbortSignal.timeout() when the caller gives none", async () => {
    let capturedSignal: AbortSignal | undefined;
    global.fetch = jest.fn(async (_url, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined;
      return fakeResponse({ ok: true });
    }) as unknown as typeof fetch;

    await apiFetch("/ping");

    expect(capturedSignal).toBeInstanceOf(AbortSignal);
  });

  test("respects a caller-provided signal instead of overriding it", async () => {
    const ctrl = new AbortController();
    let capturedSignal: AbortSignal | undefined;
    global.fetch = jest.fn(async (_url, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined;
      return fakeResponse({ ok: true });
    }) as unknown as typeof fetch;

    await apiFetch("/ping", { signal: ctrl.signal });

    expect(capturedSignal).toBe(ctrl.signal);
  });

  test("maps a fetch TimeoutError to a distinct TIMEOUT ApiError, not a generic 500", async () => {
    global.fetch = jest.fn(async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    }) as unknown as typeof fetch;

    await expect(apiFetch("/slow")).rejects.toMatchObject({
      code: "TIMEOUT",
      status: 0,
    } satisfies Partial<ApiError>);
  });

  test("re-throws a non-timeout fetch failure unchanged", async () => {
    const networkError = new TypeError("Failed to fetch");
    global.fetch = jest.fn(async () => {
      throw networkError;
    }) as unknown as typeof fetch;

    await expect(apiFetch("/down")).rejects.toBe(networkError);
  });
});
