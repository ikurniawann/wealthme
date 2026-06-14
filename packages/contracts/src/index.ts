/**
 * @wealthme/contracts — single source of truth for DTOs/validation shared by
 * the web app, the API, and (later) mobile. Add per-domain schemas here as the
 * backend grows (auth, transactions, accounts, …) and import them on both ends.
 */

export * from "./common/index.js";
export * from "./auth/index.js";
export * from "./search/index.js";
export * from "./accounts/index.js";
export * from "./categories/index.js";
export * from "./transactions/index.js";
export * from "./dashboard/index.js";
export * from "./budgets/index.js";
export * from "./goals/index.js";
export * from "./notifications/index.js";
export * from "./liabilities/index.js";
export * from "./insurances/index.js";
