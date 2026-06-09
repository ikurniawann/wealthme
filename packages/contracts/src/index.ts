/**
 * @wealthme/contracts — single source of truth for DTOs/validation shared by
 * the web app, the API, and (later) mobile. Add per-domain schemas here as the
 * backend grows (auth, transactions, accounts, …) and import them on both ends.
 */

export * from "./common/index.js";
export * from "./auth/index.js";
export * from "./budgets/index.js";
