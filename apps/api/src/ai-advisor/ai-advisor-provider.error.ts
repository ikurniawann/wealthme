/**
 * EPIC-023 Task G retry (MEDIUM five-reviewer finding) — the web app
 * previously collapsed every provider failure (bad key, rate limit, a slow
 * upstream) into one generic message. Each adapter maps its own SDK/HTTP
 * error shape onto these two, and `ExternalRequestTimeoutError` (see
 * `common/utils/external-fetch.util.ts`) covers the timeout case — giving
 * the controller a small, provider-agnostic set of error types to turn into
 * a distinguishable SSE `code`.
 */

/** The provider rejected the configured API key (401/403-shaped failure). */
export class AiAdvisorAuthError extends Error {
  constructor(provider: string) {
    super(`${provider} rejected the configured API key.`);
    this.name = "AiAdvisorAuthError";
  }
}

/**
 * Which of the provider's quotas ran out. `"daily"` is the one that matters:
 * "try again shortly" is actively wrong advice for a per-day cap, and the UI
 * repeated it for every retry while the real answer was "not until tomorrow,
 * or switch model/plan".
 */
export type RateLimitScope = "short" | "daily";

/**
 * The provider rate-limited this request (429-shaped failure).
 *
 * The extra fields exist because the generic form misled users: Gemini's 429
 * body states the exact quota that was exceeded
 * (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`, limit 20) and a
 * `retryDelay`, and the adapter read that body only to throw it away. The UI
 * then said "coba lagi sebentar lagi" on a cap that does not reset for hours,
 * so the user retried in a loop and learned nothing.
 *
 * Both fields are optional — a provider that says nothing beyond "429" still
 * produces a valid error, and the UI falls back to the generic wording.
 */
export class AiAdvisorRateLimitError extends Error {
  constructor(
    provider: string,
    readonly scope?: RateLimitScope,
    readonly retryAfterSeconds?: number,
    /** The provider's own sentence, for the server log — never shown raw to
     *  the user, since it is English and mentions billing pages. */
    readonly providerDetail?: string,
  ) {
    super(
      scope === "daily"
        ? `${provider} daily quota exhausted for this model.`
        : `${provider} rate-limited this request — try again shortly.`,
    );
    this.name = "AiAdvisorRateLimitError";
  }
}
