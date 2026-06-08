// Re-export shared Prettier config from @wealthme/config.
// Prettier at the repo root (e.g. via lint-staged) picks this up automatically.
import prettierBase from "@wealthme/config/prettier";

/** @type {import("prettier").Config} */
export default prettierBase;
