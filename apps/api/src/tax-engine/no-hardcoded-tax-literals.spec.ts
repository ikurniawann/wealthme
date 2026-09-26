import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const GUARDED = [
  "common/utils/pph21.util.ts",
  "tax/tax.service.ts",
  ...readdirSync(join(ROOT, "tax-engine"))
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".spec.ts"))
    .map((f) => `tax-engine/${f}`),
  ...readdirSync(join(ROOT, "tax"))
    .filter((f) => f.endsWith(".service.ts"))
    .map((f) => `tax/${f}`),
];
// Rates/thresholds that must only live in tax-rules/data.
const FORBIDDEN = [
  /\b0\.0?5\b/,
  /\b0\.15\b/,
  /\b0\.25\b/,
  /\b0\.3\b/,
  /\b0\.35\b/,
  /\b0\.005\b/,
  /\b0\.0021\b/,
  /\b54_?000_?000n?\b/,
  /\b60_?000_?000n?\b/,
  /\b250_?000_?000n?\b/,
  /\b6_?000_?000n?\b/,
  /\b500_?000_?000n?\b/,
  /\b4_?800_?000_?000n?\b/,
  /\b7_?500_?000n?\b/,
];

describe("tax numbers live only in the rule registry", () => {
  it.each(GUARDED)("%s has no hardcoded tax rate/threshold", (rel) => {
    const src = readFileSync(join(ROOT, rel), "utf8");
    for (const re of FORBIDDEN)
      expect({ rel, match: src.match(re)?.[0] ?? null }).toEqual({
        rel,
        match: null,
      });
  });
});
