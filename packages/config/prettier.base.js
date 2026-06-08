/**
 * Shared Prettier base config.
 *
 * Usage in consuming package (e.g. prettier.config.mjs):
 *   import prettierBase from "@wealthme/config/prettier";
 *   export default prettierBase;
 *
 * @type {import("prettier").Config}
 */
const prettierBase = {
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  endOfLine: "lf",
  bracketSpacing: true,
  arrowParens: "always",
};

export default prettierBase;
