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
export function parseRateScaledByHundred(rateStr: string): bigint {
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

export const MAX_SCHEDULE_ROWS = 600;

export interface RatePeriodInput {
  period: number;
  baseRatePercent: string;
  fixedRateMonths: number | null;
  floatingRatePercent: string | null;
}

function isFloatingPeriod(input: RatePeriodInput): boolean {
  return (
    input.fixedRateMonths !== null &&
    input.floatingRatePercent !== null &&
    input.period > input.fixedRateMonths
  );
}

export function rateForPeriod(input: RatePeriodInput): string {
  return isFloatingPeriod(input) && input.floatingRatePercent !== null
    ? input.floatingRatePercent
    : input.baseRatePercent;
}

/** Whole installment months between `start` and `now` (UTC), never negative. */
export function monthsElapsed(start: Date, now: Date): number {
  const months =
    (now.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - start.getUTCMonth()) -
    (now.getUTCDate() < start.getUTCDate() ? 1 : 0);
  return Math.max(0, months);
}

export interface ScheduleInput {
  method: InterestMethod;
  remainingBalance: bigint;
  originalPrincipal: bigint;
  annualInterestRatePercent: string;
  rateIsMonthly?: boolean;
  /** Fixed monthly payment (flat/anuitas installment or efektif minimumPayment); null = none. */
  installmentAmount: bigint | null;
  /** Installments left on the contract; null = open-ended (e.g. a credit card). */
  remainingMonths: number | null;
  /** Contract period number of the next installment, 1-based. */
  firstPeriod: number;
  fixedRateMonths: number | null;
  floatingRatePercent: string | null;
}

export interface ScheduleRow {
  period: number;
  installment: bigint;
  interest: bigint;
  principal: bigint;
  remaining: bigint;
}

export function buildSchedule(input: ScheduleInput): ScheduleRow[] {
  const maxRows = Math.min(
    MAX_SCHEDULE_ROWS,
    input.remainingMonths ?? MAX_SCHEDULE_ROWS,
  );
  const equalPrincipal =
    input.method === "efektif" &&
    input.installmentAmount === null &&
    input.remainingMonths !== null
      ? roundHalfUpDivide(input.remainingBalance, BigInt(input.remainingMonths))
      : null;
  if (input.installmentAmount === null && equalPrincipal === null) return [];

  const denominator = rateDenominator(input.rateIsMonthly);
  const rows: ScheduleRow[] = [];
  let balance = input.remainingBalance;
  let installment = input.installmentAmount ?? 0n;
  let floatingRecomputed = false;

  for (let i = 0; i < maxRows && balance > 0n; i += 1) {
    const ratePeriod: RatePeriodInput = {
      period: input.firstPeriod + i,
      baseRatePercent: input.annualInterestRatePercent,
      fixedRateMonths: input.fixedRateMonths,
      floatingRatePercent: input.floatingRatePercent,
    };
    const ratePercent = rateForPeriod(ratePeriod);
    if (
      input.method === "anuitas" &&
      !floatingRecomputed &&
      isFloatingPeriod(ratePeriod) &&
      input.remainingMonths !== null
    ) {
      // Banks re-amortise the outstanding balance over the remaining tenor once the fixed period ends.
      installment = computeInstallment({
        method: "anuitas",
        principal: balance,
        annualInterestRatePercent: ratePercent,
        tenorMonths: input.remainingMonths - i,
        rateIsMonthly: input.rateIsMonthly,
      });
      floatingRecomputed = true;
    }

    const interestDue = monthlyInterestDue({
      method: input.method,
      originalPrincipal: input.originalPrincipal,
      balance,
      rateScaled: parseRateScaledByHundred(ratePercent),
      denominator,
    });
    const payoff = balance + interestDue;
    const isLastPeriod =
      input.remainingMonths !== null && i === input.remainingMonths - 1;
    const scheduled =
      equalPrincipal !== null ? equalPrincipal + interestDue : installment;
    const payment = isLastPeriod || scheduled > payoff ? payoff : scheduled;
    const interest = interestDue > payment ? payment : interestDue;
    const principal = payment - interest;
    balance -= principal;

    rows.push({
      period: ratePeriod.period,
      installment: payment,
      interest,
      principal,
      remaining: balance,
    });
    if (principal === 0n) break;
  }
  return rows;
}
