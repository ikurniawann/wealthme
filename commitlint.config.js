/** @type {import('@commitlint/types').UserConfig} */
const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Explicitly enumerate the allowed types used in this project.
    // @commitlint/config-conventional already covers all of these;
    // listed here for clarity and to document the project convention.
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "refactor", "docs", "test", "chore", "perf", "ci"],
    ],
  },
};

export default config;
