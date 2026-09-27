import {
  FX_CURRENCY_CODES,
  FX_CURRENCY_DECIMALS,
  FX_RATE_SCALE,
  type FxCurrencyCode,
} from "./currencies.js";

const DECIMAL_RE = /^(-?)(\d+)(?:\.(\d+))?$/;

export function isFxCurrency(value: string): value is FxCurrencyCode {
  return (FX_CURRENCY_CODES as readonly string[]).includes(value);
}

export function parseScaled(value: string, scale: number): bigint {
  const match = DECIMAL_RE.exec(value);
  if (!match) throw new RangeError(`"${value}" is not a decimal number`);
  const [, sign, intPart, frac = ""] = match;
  if (frac.length > scale) {
    throw new RangeError(`"${value}" has more than ${scale} decimal places`);
  }
  const magnitude = BigInt(`${intPart}${frac.padEnd(scale, "0")}`);
  return sign === "-" ? -magnitude : magnitude;
}

export function parseMinor(amount: string, currency: FxCurrencyCode): bigint {
  return parseScaled(amount, FX_CURRENCY_DECIMALS[currency]);
}

/** Integer division rounding half away from zero (round-half-up on magnitude). */
export function divRoundHalfUp(n: bigint, d: bigint): bigint {
  if (d <= 0n) throw new RangeError("divisor must be positive");
  const negative = n < 0n;
  const magnitude = negative ? -n : n;
  const quotient = (magnitude * 2n + d) / (2n * d);
  return negative ? -quotient : quotient;
}

export function formatScaled(value: bigint, scale: number): string {
  const negative = value < 0n;
  const digits = (negative ? -value : value)
    .toString()
    .padStart(scale + 1, "0");
  const body =
    scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
  return negative ? `-${body}` : body;
}

/** `amount` (canonical decimal in `currency`) → IDR at `targetScale` (0 = whole rupiah, 2 = sen). */
export function convertToIdr(input: {
  amount: string;
  currency: FxCurrencyCode;
  idrPerUnit: string;
  targetScale: 0 | 2;
}): bigint {
  const decimals = FX_CURRENCY_DECIMALS[input.currency];
  const minor = parseScaled(input.amount, decimals);
  if (input.currency === "IDR") return minor * 10n ** BigInt(input.targetScale);
  const rate = parseScaled(input.idrPerUnit, FX_RATE_SCALE);
  if (rate <= 0n)
    throw new RangeError(`rate for ${input.currency} must be positive`);
  const shift = decimals + FX_RATE_SCALE - input.targetScale;
  return divRoundHalfUp(minor * rate, 10n ** BigInt(shift));
}

/** IDR per 1 unit of X from two EUR-based ECB quotes, at FX_RATE_SCALE. */
export function deriveIdrPerUnit(eurToIdr: string, eurToX: string): string {
  const idr = parseScaled(eurToIdr, FX_RATE_SCALE);
  const x = parseScaled(eurToX, FX_RATE_SCALE);
  return formatScaled(
    divRoundHalfUp(idr * 10n ** BigInt(FX_RATE_SCALE), x),
    FX_RATE_SCALE,
  );
}
