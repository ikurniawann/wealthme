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

/** The provider rate-limited this request (429-shaped failure). */
export class AiAdvisorRateLimitError extends Error {
  constructor(provider: string) {
    super(`${provider} rate-limited this request — try again shortly.`);
    this.name = "AiAdvisorRateLimitError";
  }
}
