// @ts-check
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";

/**
 * Shared ESLint base config (flat config format, ESLint v9+).
 * Framework-agnostic: TypeScript + import ordering + Prettier compat.
 *
 * Usage in consuming package (e.g. apps/web/eslint.config.mjs):
 *   import baseConfig from "@wealthme/config/eslint";
 *   export default [...baseConfig];
 */

/** @type {import("typescript-eslint").ConfigArray} */
const baseConfig = tseslint.config(
  {
    ignores: ["dist/**", ".next/**", "node_modules/**", "coverage/**"],
  },
  tseslint.configs.recommended,
  {
    plugins: {
      import: importPlugin,
    },
    rules: {
      // TypeScript
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],

      // Import ordering
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
            "type",
          ],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "import/no-duplicates": "error",
    },
  },
  // Must be last — disables rules that conflict with Prettier
  eslintConfigPrettier,
);

export default baseConfig;
