/**
 * @wealthme/contracts — single source of truth for DTOs/validation shared by
 * the web app, the API, and (later) mobile. Add per-domain schemas here as the
 * backend grows (auth, transactions, accounts, …) and import them on both ends.
 */

export * from "./common/index.js";
export * from "./auth/index.js";
export * from "./search/index.js";
export * from "./accounts/index.js";
export * from "./allowance-requests/index.js";
export * from "./members/index.js";
export * from "./categories/index.js";
export * from "./coa/index.js";
export * from "./transactions/index.js";
export * from "./dashboard/index.js";
export * from "./budgets/index.js";
export * from "./goals/index.js";
export * from "./notifications/index.js";
export * from "./assets/index.js";
export * from "./investments/index.js";
export * from "./liabilities/index.js";
export * from "./member-category-allowances/index.js";
export * from "./inheritance/index.js";
export * from "./insurances/index.js";
export * from "./split-bills/index.js";
export * from "./reports/index.js";
export * from "./exports/index.js";
export * from "./calculators/index.js";
export * from "./donations/index.js";
export * from "./tax/index.js";
export * from "./reference-items/index.js";
