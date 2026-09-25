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

export type InterestMethod = "efektif" | "flat" | "anuitas";

export interface SplitPaymentInput {
  /** EPIC-033 p20 — true for kartu_kredit: the rate is already per month. */
  rateIsMonthly?: boolean;
  /** Defaults to "efektif"; "anuitas" splits like "efektif", only its installment is fixed. */
  method?: InterestMethod;
  /** Required for "flat": interest accrues on the original principal every month. */
  originalPrincipal?: bigint;
  paymentAmount: bigint;
  remainingBalance: bigint;
  annualInterestRatePercent: string;
}

export interface SplitPaymentResult {
  interest: bigint;
  principal: bigint;
}

export interface InstallmentInput {
  method: InterestMethod;
  principal: bigint;
  annualInterestRatePercent: string;
  tenorMonths: number;
  rateIsMonthly?: boolean;
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

function rateDenominator(rateIsMonthly: boolean | undefined): bigint {
  return rateIsMonthly ? PER_MONTH_RATE_DENOMINATOR : MONTHLY_RATE_DENOMINATOR;
}

function monthlyInterestDue(input: {
  method: InterestMethod;
  originalPrincipal: bigint | undefined;
  balance: bigint;
  rateScaled: bigint;
  denominator: bigint;
}): bigint {
  if (input.balance <= 0n) return 0n;
  if (input.method === "flat") {
    if (input.originalPrincipal === undefined) {
      throw new Error("flat interest needs originalPrincipal");
    }
    return roundHalfUpDivide(
      input.originalPrincipal * input.rateScaled,
      input.denominator,
    );
  }
  return roundHalfUpDivide(input.balance * input.rateScaled, input.denominator);
}

/**
 * Splits a liability payment into its interest and principal components.
 *
 * - `interest = round-half-up(base * monthlyRate)` where `base` is the
 *   original principal for "flat" and the remaining balance otherwise,
 *   capped at `paymentAmount` so principal never goes negative.
 * - `principal = paymentAmount - interest`, capped at `remainingBalance` so
 *   the balance never goes negative.
 */
export function splitPayment(input: SplitPaymentInput): SplitPaymentResult {
  const interestDue = monthlyInterestDue({
    method: input.method ?? "efektif",
    originalPrincipal: input.originalPrincipal,
    balance: input.remainingBalance,
    rateScaled: parseRateScaledByHundred(input.annualInterestRatePercent),
    denominator: rateDenominator(input.rateIsMonthly),
  });

  const interest =
    interestDue > input.paymentAmount ? input.paymentAmount : interestDue;

  const principalRaw = input.paymentAmount - interest;
  const principal =
    principalRaw > input.remainingBalance
      ? input.remainingBalance
      : principalRaw;

  return { interest, principal };
}

/**
 * Monthly installment for a new loan of `principal` over `tenorMonths`.
 * flat: (P + P·r·n) / n. anuitas: P·r·(1+r)^n / ((1+r)^n − 1).
 * efektif: the FIRST month of an equal-principal loan, P/n + P·r.
 */
export function computeInstallment(input: InstallmentInput): bigint {
  if (!Number.isInteger(input.tenorMonths) || input.tenorMonths < 1) {
    throw new RangeError("tenorMonths must be a positive integer");
  }
  const principal = input.principal;
  if (principal <= 0n) return 0n;
  const n = BigInt(input.tenorMonths);
  const rate = parseRateScaledByHundred(input.annualInterestRatePercent);
  const denominator = rateDenominator(input.rateIsMonthly);

  switch (input.method) {
    case "flat":
      return roundHalfUpDivide(
        principal * denominator + principal * rate * n,
        denominator * n,
      );
    case "anuitas": {
      if (rate === 0n) return roundHalfUpDivide(principal, n);
      // With r = rate/denominator the annuity formula becomes an exact integer ratio.
      const growth = (denominator + rate) ** n;
      return roundHalfUpDivide(
        principal * rate * growth,
        denominator * (growth - denominator ** n),
      );
    }
    case "efektif":
      return (
        roundHalfUpDivide(principal, n) +
        roundHalfUpDivide(principal * rate, denominator)
      );
  }
}

export function defaultInterestMethod(liabilityType: string): InterestMethod {
  switch (liabilityType) {
    case "kpr":
      return "anuitas";
    case "kendaraan":
    case "pinjaman_pribadi":
      return "flat";
    default:
      return "efektif";
  }
}
