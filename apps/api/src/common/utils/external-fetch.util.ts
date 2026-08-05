/**
 * EPIC-023 Task G retry (HIGH five-reviewer finding) — every outbound call
 * to a third-party service (CoinGecko, Yahoo Finance, the AI providers) must
 * be bounded: an upstream that accepts the connection and never responds
 * must not hang the caller (or, for `InvestmentsService.findAll`'s
 * `Promise.all`, an entire portfolio-list request) indefinitely. This module
 * gives every adapter the same two primitives — a real `fetch` timeout via
 * `AbortSignal.timeout`, and a generic `Promise` timeout for SDKs (e.g.
 * `yahoo-finance2`) that don't expose an abort signal of their own — plus a
 * single error type so a timeout is distinguishable from any other failure.
 */

/** Thrown when an outbound call to an external service does not complete
 * within its bound. Distinguished from a generic network/parse failure so
 * callers can surface "this took too long" rather than a generic error. */
export class ExternalRequestTimeoutError extends Error {
  constructor(label: string) {
    super(`${label} timed out`);
    this.name = "ExternalRequestTimeoutError";
  }
}

/** `AbortSignal.timeout()` fires a `TimeoutError` DOMException; a caller
 * that also aborts manually may see `AbortError`. Both mean "took too long,"
 * not "the server rejected the request." Checked by duck-typed `.name`
 * rather than `instanceof Error` — Node's `DOMException` does not extend
 * `Error`, even though it carries the same `name`/`message` shape. */
export function isAbortTimeoutError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const name = (err as { name?: unknown }).name;
  return name === "TimeoutError" || name === "AbortError";
}

/**
 * `fetch` wrapped with a hard timeout. Rejects with
 * `ExternalRequestTimeoutError` (rather than a raw `DOMException`) when the
 * bound is exceeded, so callers can `instanceof`-check it directly.
 */
export async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
  label: string,
): Promise<Response> {
  try {
    return await fetch(input, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (isAbortTimeoutError(err)) {
      throw new ExternalRequestTimeoutError(label);
    }
    throw err;
  }
}

/**
 * Races an arbitrary promise (e.g. an SDK call with no abort-signal option,
 * such as `yahoo-finance2`'s `.quote()`) against a timer. Does not cancel
 * the underlying operation — only the SDKs that support real cancellation
 * (fetch-based adapters, above) get that — but it guarantees the CALLER
 * never waits past `timeoutMs`, which is what prevents an unresponsive
 * upstream from hanging `Promise.all` callers like
 * `InvestmentsService.findAll`.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new ExternalRequestTimeoutError(label)),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
