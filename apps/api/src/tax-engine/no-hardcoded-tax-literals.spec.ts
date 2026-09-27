import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const listTs = (dir: string) =>
  readdirSync(join(ROOT, dir), { withFileTypes: true, recursive: true })
    .filter(
      (e) =>
        e.isFile() && e.name.endsWith(".ts") && !e.name.endsWith(".spec.ts"),
    )
    .map((e) => join(e.parentPath ?? e.path, e.name).slice(ROOT.length + 1));

// Review fix round 1 (Important #1) — this guard used to only cover
// tax-engine/ and tax/, so calculators/dto/pph21.dto.ts's hardcoded
// PTKP_VALUES (Important #2) slipped through entirely.
const GUARDED = [
  "common/utils/pph21.util.ts",
  ...listTs("tax-engine"),
  ...listTs("tax"),
  ...listTs("calculators"),
];

// Review fix round 1 (Important #1) — the previous \b-bounded literals
// missed every underscore-separated bigint the engine actually writes
// (0.30 doesn't end on a \b before a trailing "0"; 5_000_000_000,
// 4_500_000, 112_500_000, and the 1000n rounding unit weren't listed at
// all) and produced a false positive on the legitimate 0.5 (50%) NPPN
// ratio because `0\.0?5` also matches "0.5". `(?<![\d.])`/`(?![\d_])`
// replace `\b` so a match can't be a substring of a larger number, and
// each decimal rate is spelled out exactly (with an optional trailing
// zero for the "0.30" form) instead of relying on an optional leading
// zero that conflated 0.05 with 0.5.
function decimalRate(digits: string): RegExp {
  return new RegExp(`(?<![\\d.])0\\.${digits}0?(?![\\d_])`);
}
function threshold(digits: string): RegExp {
  const pattern = digits.replace(/_/g, "_?");
  return new RegExp(`(?<![\\d_])${pattern}n?(?![\\d_])`);
}

// Rates/thresholds that must only live in tax-rules/data.
const FORBIDDEN: readonly RegExp[] = [
  decimalRate("05"),
  decimalRate("15"),
  decimalRate("25"),
  decimalRate("3"),
  decimalRate("35"),
  decimalRate("005"),
  decimalRate("0021"),
  threshold("54_000_000"),
  threshold("58_500_000"),
  threshold("60_000_000"),
  threshold("63_000_000"),
  threshold("67_500_000"),
  threshold("72_000_000"),
  threshold("112_500_000"),
  threshold("117_000_000"),
  threshold("121_500_000"),
  threshold("126_000_000"),
  threshold("250_000_000"),
  threshold("500_000_000"),
  threshold("5_000_000_000"),
  threshold("6_000_000"),
  threshold("4_800_000_000"),
  threshold("7_500_000"),
  threshold("4_500_000"),
  threshold("1_000"),
  // Bps literals: a rate/threshold hardcoded as a `rateBps`-shaped number,
  // or a raw bigint bps literal divided by the 10_000 (basis-point) or 20
  // (5%) denominator instead of reading `band.rateBps`/the registry.
  /rateBps\s*:\s*\d/,
  /\d+n\s*\/\s*10_?000n/,
  /\/\s*20n(?![\d_])/,
];

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/** Returns the first forbidden literal found in `src` (comments excluded), or null. */
export function findForbiddenTaxLiteral(src: string): string | null {
  const code = stripComments(src);
  for (const re of FORBIDDEN) {
    const match = code.match(re)?.[0];
    if (match) return match;
  }
  return null;
}

describe("tax numbers live only in the rule registry", () => {
  it.each(GUARDED)("%s has no hardcoded tax rate/threshold", (rel) => {
    const src = readFileSync(join(ROOT, rel), "utf8");
    expect({ rel, match: findForbiddenTaxLiteral(src) }).toEqual({
      rel,
      match: null,
    });
  });
});

describe("findForbiddenTaxLiteral — guard fixtures (review fix round 1, Important #1)", () => {
  it.each([
    ["a hardcoded bps ratio literal", "const x = taxable * 1500n / 10_000n;"],
    ["a hardcoded 30% decimal literal", "const rate = 0.30;"],
    ["a hardcoded 5% decimal literal", "const rate = 0.05;"],
    ["the 5-miliar Pasal 17 threshold", "const top = 5_000_000_000n;"],
    ["the PTKP dependent add-on", "const addOn = 4_500_000n;"],
    ["the K/I base PTKP", "const base = 112_500_000n;"],
    ["the PKP rounding unit", "const unit = 1_000n;"],
    ["a raw rateBps literal", "const band = { rateBps: 1500 };"],
    ["a /20n ratio shortcut for 5%", "const bj = gross / 20n;"],
  ])("flags %s", (_label, fixture) => {
    expect(findForbiddenTaxLiteral(fixture)).not.toBeNull();
  });

  it.each([
    ["the legitimate NPPN 50% ratio (0.5, not 0.05)", "const half = 0.5;"],
    [
      "registry-driven code (BigInt(band.rateBps) over 10_000n via a variable)",
      "divHalfUp(taxable * BigInt(band.rateBps), 10_000n)",
    ],
    [
      "a forbidden number that only appears inside a comment",
      "// old rate was 0.30\nconst rate = ruleAt(...).value.rateBps;",
    ],
    ["an unrelated large bigint", "const x = 999_999_999_999_999n;"],
  ])("does not flag %s", (_label, fixture) => {
    expect(findForbiddenTaxLiteral(fixture)).toBeNull();
  });
});
