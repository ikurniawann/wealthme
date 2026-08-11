// EPIC-024 Task C review fix (HIGH, converged react-reviewer + review-qa-agent
// + adversarial) — the lot<->lembar (1 lot = 100 lembar) conversion previously
// round-tripped through `parseFloat`/`String()`, which drifts for odd-lot
// values (e.g. `7 / 100 * 100 === 7.000000000000001` in JS float math). That
// silently corrupts a money-adjacent field (share quantity) on every toggle.
//
// Fixed here with exact decimal-string arithmetic on BigInt-scaled digits —
// multiplying/dividing by exactly 100 only ever shifts the decimal point, it
// never goes through a floating-point intermediate. Kept free of React/DOM so
// it is trivially unit-testable in isolation from the page component
// (matches the `split-math.ts` / `credit-card-filter.ts` precedent in this
// app for page-local pure helpers).

export type QuantityUnit = "lot" | "lembar";

interface ParsedDecimal {
  negative: boolean;
  /** All significant digits (integer part + fractional part) with no separator. */
  digits: bigint;
  /** Number of fractional digits `digits` represents (0 = a plain integer). */
  scale: number;
}

const PLAIN_DECIMAL_RE = /^-?\d*\.?\d*$/;

/** Parse a plain (non-scientific) decimal string exactly. `null` if not a valid number. */
function parseDecimal(raw: string): ParsedDecimal | null {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "-" || trimmed === ".") return null;
  if (!PLAIN_DECIMAL_RE.test(trimmed)) return null;

  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [intPartRaw = "", fracPartRaw = ""] = unsigned.split(".");
  if (intPartRaw === "" && fracPartRaw === "") return null;

  const digitsStr = (intPartRaw || "0") + fracPartRaw;
  return { negative, digits: BigInt(digitsStr), scale: fracPartRaw.length };
}

/** Render a parsed decimal back to its canonical (no trailing-zero, no leading-zero) string form. */
function formatDecimal(parsed: ParsedDecimal): string {
  const { digits, scale } = parsed;
  const digitsStr = digits.toString().padStart(scale + 1, "0");
  const intPart = scale === 0 ? digitsStr : digitsStr.slice(0, -scale);
  const fracPart =
    scale === 0 ? "" : digitsStr.slice(-scale).replace(/0+$/, "");

  const normalizedInt = intPart.replace(/^0+(?=\d)/, "");
  const value = fracPart ? `${normalizedInt}.${fracPart}` : normalizedInt;
  const isZero = digits === BigInt(0);
  return parsed.negative && !isZero ? `-${value}` : value;
}

/**
 * Multiply a parsed decimal by 10^power (power may be negative). Exact —
 * never touches a float. Positive power always keeps scale >= 0 by moving
 * digits into the integer side instead.
 */
function shiftByPowerOfTen(
  parsed: ParsedDecimal,
  power: number,
): ParsedDecimal {
  const newScale = parsed.scale - power;
  if (newScale >= 0) return { ...parsed, scale: newScale };
  const factor = BigInt(10) ** BigInt(-newScale);
  return { ...parsed, digits: parsed.digits * factor, scale: 0 };
}

/** Multiply a decimal string by exactly 100 (1 lot -> lembar), with no float drift. */
export function multiplyBy100(value: string): string {
  const parsed = parseDecimal(value);
  if (!parsed) return value;
  return formatDecimal(shiftByPowerOfTen(parsed, 2));
}

/** Divide a decimal string by exactly 100 (lembar -> lot), with no float drift. */
export function divideBy100(value: string): string {
  const parsed = parseDecimal(value);
  if (!parsed) return value;
  return formatDecimal(shiftByPowerOfTen(parsed, -2));
}

/**
 * EPIC-024 C3 (D9) — convert a DISPLAYED quantity between lot and lembar
 * (1 lot = 100 lembar). Never touches the canonical stored value directly —
 * only the number shown in the input while the user has the toggle open.
 * Exact (see module docblock) so odd-lot values (e.g. 7 lembar) round-trip
 * without drift.
 */
export function convertQuantityDisplay(
  value: string,
  from: QuantityUnit,
  to: QuantityUnit,
): string {
  if (from === to) return value;
  return from === "lot" ? multiplyBy100(value) : divideBy100(value);
}

/**
 * EPIC-024 C3 (D9) — canonicalize a saham quantity to lembar at submit time,
 * from whatever is currently displayed + selected. This is what makes the
 * conversion idempotent: re-saving without touching the quantity field
 * re-derives the SAME canonical value every time, because the multiply-by-100
 * only ever applies to a live "lot" display value, never to an
 * already-canonical "lembar" value re-multiplied by mistake.
 */
export function canonicalizeSahamQuantity(
  quantity: string,
  unit: QuantityUnit,
): string {
  return unit === "lot" ? multiplyBy100(quantity) : quantity;
}
