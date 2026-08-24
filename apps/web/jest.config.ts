import type { Config } from "jest";
import nextJest from "next/jest.js";

// EPIC-027 group 7 — pin the suite's timezone. `isoToDateInputValue`
// (hooks/receipt-scan.ts) converts a UTC instant from the scan endpoint into
// a date-input value, and its regression tests only expose a local-vs-UTC
// getter mix-up when the host zone is NOT UTC. Most CI runners default to
// UTC, where local and UTC getters are identical — the guard would silently
// pass against a reintroduced bug. Jakarta is east of UTC and is the app's
// actual user base, so the boundary cases stay meaningful everywhere.
// Set here rather than in jest.setup.ts: this file is evaluated before the
// workers are forked, so they inherit the value.
process.env.TZ = "Asia/Jakarta";

const createJestConfig = nextJest({
  // Provide the path to the Next.js app to load next.config.js and .env files.
  dir: "./",
});

const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/.next/",
    "<rootDir>/tests/e2e/",
  ],
};

// react-markdown and its whole unified/remark/micromark dependency chain ship
// ESM only, and next/jest's generated `transformIgnorePatterns` skip
// node_modules — so every suite that reaches ai/markdown-message.tsx died on
// `SyntaxError: Unexpected token 'export'` before running one assertion.
//
// Setting `transformIgnorePatterns` in the config object above does NOT work:
// next/jest overwrites it with its own. And appending a pattern cannot help
// either — a file is ignored if it matches ANY pattern, so an extra entry can
// only ever ignore more. The allow-list has to be widened inside next's own
// patterns, which is what the injection below does, preserving next's
// entries (geist, next/dist/client, …) rather than replacing them.
//
// The alternative was mapping react-markdown to a stub. That keeps the suites
// green while silently deleting the rendering they exist to check, which is
// worse than a slightly slower transform.
const ESM_ONLY_DEPS = [
  "react-markdown",
  // `[^@/]*` so the alternative stops before pnpm's `@<version>` suffix —
  // pnpm names each directory `<pkg>@<version>/node_modules/<pkg>`.
  "remark[^@/]*",
  "rehype[^@/]*",
  "mdast[^@/]*",
  "micromark[^@/]*",
  "unist[^@/]*",
  "vfile[^@/]*",
  "hast[^@/]*",
  "character-entities[^@/]*",
  "estree-util[^@/]*",
  "unified",
  "property-information",
  "space-separated-tokens",
  "comma-separated-tokens",
  "html-url-attributes",
  "html-void-elements",
  "stringify-entities",
  "web-namespaces",
  "decode-named-character-reference",
  "trim-lines",
  "longest-streak",
  "markdown-table",
  "is-plain-obj",
  "escape-string-regexp",
  "devlop",
  "trough",
  "zwitch",
  "ccount",
  "bail",
].join("|");

// createJestConfig is exported this way to ensure next/jest can load the
// (async) Next.js config.
const withNext = createJestConfig(config);

export default async () => {
  const generated = await withNext();
  return {
    ...generated,
    transformIgnorePatterns: (generated.transformIgnorePatterns ?? []).map(
      (pattern) =>
        pattern.includes("node_modules")
          ? // Widen the FIRST `(?!( … )` group — next's package allow-list —
            // by prefixing our packages onto its alternation.
            pattern.replace("(?!(", `(?!(${ESM_ONLY_DEPS}|`)
          : pattern,
    ),
  };
};
