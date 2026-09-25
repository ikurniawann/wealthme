/**
 * EPIC-023 Task A2 — principal/interest split for a liability payment.
 *
 * All arithmetic is done in integer/BigInt space to avoid the float
 * precision loss that would miss the round-half-up boundary cases (see the
 * golden schedule in amortisation.util.spec.ts, months 5 and 6).
 *
 * `annualInterestRatePercent` comes from `Liability.interestRate`, a
 * `Decimal(5,2)` — at most 2 fractional digits — so it is parsed into a
 * fixed-point integer scaled by 100 (e.g. "12.00" -> 1200n) instead of being
 * coerced through `Number`/`parseFloat`.
 *
 * `monthlyRate = annualRatePercent / 100 / 12`. Expressed over the scaled
 * rate, `remainingBalance * rateScaled100` divided by `100 * 100 * 12`
 * (100 to undo the percent scale, 100 to undo the fixed-point scale, 12 for
 * the monthly conversion) gives the exact rational interest due, which is
 * then rounded half-up to the nearest rupiah.
 */

export interface SplitPaymentInput {
  /** EPIC-033 p20 — true for kartu_kredit: the rate is already per month. */
  rateIsMonthly?: boolean;
  paymentAmount: bigint;
  remainingBalance: bigint;
  annualInterestRatePercent: string;
}

export interface SplitPaymentResult {
  interest: bigint;
  principal: bigint;
}

// (percent scale 100) * (fixed-point scale 100) * (12 months/year)
const MONTHLY_RATE_DENOMINATOR = 120_000n;
// EPIC-033 p20 — credit cards quote their rate PER MONTH ("Bunga/Bulan"),
// so the /12 step is skipped for them.
const PER_MONTH_RATE_DENOMINATOR = 10_000n;

/**
 * Parses a decimal string with at most 2 fractional digits (matching
 * `Decimal(5,2)`) into an integer scaled by 100 — e.g. "12.00" -> 1200n,
 * "7.5" -> 750n, "0" -> 0n. Never touches floating point.
 */
function parseRateScaledByHundred(rateStr: string): bigint {
  const trimmed = rateStr.trim();
  const [intPartRaw, fracPartRaw = ""] = trimmed.split(".");
  const intPart = intPartRaw === "" ? "0" : intPartRaw;
  const fracPart = (fracPartRaw + "00").slice(0, 2);
  return BigInt(`${intPart}${fracPart}`);
}

/** Round-half-up division for non-negative BigInt operands. */
function roundHalfUpDivide(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder * 2n >= denominator ? quotient + 1n : quotient;
}

/**
 * Splits a liability payment into its interest and principal components.
 *
 * - `interest = round-half-up(remainingBalance * monthlyRate)`, capped at
 *   `paymentAmount` so principal never goes negative.
 * - `principal = paymentAmount - interest`, capped at `remainingBalance` so
 *   the balance never goes negative.
 */
export function splitPayment(input: SplitPaymentInput): SplitPaymentResult {
  const rateScaled = parseRateScaledByHundred(input.annualInterestRatePercent);
  const interestDue = roundHalfUpDivide(
    input.remainingBalance * rateScaled,
    input.rateIsMonthly ? PER_MONTH_RATE_DENOMINATOR : MONTHLY_RATE_DENOMINATOR,
  );

  const interest =
    interestDue > input.paymentAmount ? input.paymentAmount : interestDue;

  const principalRaw = input.paymentAmount - interest;
  const principal =
    principalRaw > input.remainingBalance
      ? input.remainingBalance
      : principalRaw;

  return { interest, principal };
}
