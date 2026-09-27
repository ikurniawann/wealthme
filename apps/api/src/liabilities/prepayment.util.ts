/**
 * Revisi K — early-repayment (pelunasan dipercepat) simulation. Read-only:
 * it reuses buildSchedule for both the "before" and "after" projections, so
 * no installment math lives here.
 */
import {
  buildSchedule,
  computeInstallment,
  currentInstallment,
  parseRateScaledByHundred,
  ratePlanOf,
  roundHalfUpDivide,
  type InterestMethod,
  type ScheduleInput,
  type ScheduleRow,
} from "./amortisation.util";
import { rateAt } from "./rate-plan.util";

export type PrepaymentMode = "full" | "reduce_tenor" | "reduce_installment";

export const PREPAYMENT_MODES: readonly PrepaymentMode[] = [
  "full",
  "reduce_tenor",
  "reduce_installment",
];

// (percent scale 100) * (fixed-point scale 100)
const PERCENT_DENOMINATOR = 10_000n;

// Research: commonly 1-3% of the prepaid principal, up to 7% (docs/research/2026-09-26-kpr-indonesia.md §6).
export const DEFAULT_PREPAYMENT_PENALTY_PERCENT = "1.00";
export const MAX_PREPAYMENT_PENALTY_PERCENT = "10.00";

/** Penalty on the prepaid principal, round-half-up to the rupiah. */
export function prepaymentPenalty(
  prepaidPrincipal: bigint,
  penaltyPercent: string,
): bigint {
  return roundHalfUpDivide(
    prepaidPrincipal * parseRateScaledByHundred(penaltyPercent),
    PERCENT_DENOMINATOR,
  );
}

/**
 * Months a level `installment` needs to clear `balance` at a constant annual
 * rate; null if it never does. `method` defaults to "anuitas" (interest on
 * the shrinking balance); "flat" instead accrues interest on
 * `originalPrincipal` every month (falls back to `balance` when omitted —
 * only correct when the flat loan's original base is unchanged).
 */
export function monthsToPayOff(
  balance: bigint,
  annualRatePercent: string,
  installment: bigint,
  method: InterestMethod = "anuitas",
  originalPrincipal?: bigint,
): number | null {
  const rows = buildSchedule({
    method,
    remainingBalance: balance,
    originalPrincipal:
      method === "flat" ? (originalPrincipal ?? balance) : balance,
    annualInterestRatePercent: annualRatePercent,
    installmentAmount: installment,
    remainingMonths: null,
    firstPeriod: 1,
    fixedRateMonths: null,
    floatingRatePercent: null,
  });
  return rows.at(-1)?.remaining === 0n ? rows.length : null;
}

export interface PrepaymentInput {
  schedule: ScheduleInput;
  mode: PrepaymentMode;
  /** Ignored for "full" (the whole remaining balance is prepaid). */
  amount: bigint;
  penaltyPercent: string;
}

export interface PrepaymentResult {
  mode: PrepaymentMode;
  prepaidPrincipal: bigint;
  penalty: bigint;
  cashOutNow: bigint;
  installmentBefore: bigint | null;
  installmentAfter: bigint | null;
  remainingMonthsBefore: number;
  remainingMonthsAfter: number;
  totalInterestBefore: bigint;
  totalInterestAfter: bigint;
  interestSaved: bigint;
  netSaving: bigint;
  /** What recording persists: the installment and tenor from `schedule.firstPeriod` on (null = unchanged / paid off). */
  newInstallmentAmount: bigint | null;
  newTenorMonths: number | null;
}

function totalInterest(rows: ScheduleRow[]): bigint {
  return rows.reduce((sum, row) => sum + row.interest, 0n);
}

interface AfterState {
  rows: ScheduleRow[];
  newInstallmentAmount: bigint | null;
  newTenorMonths: number | null;
}

/**
 * Revisi K flat-KPR rule (documented in the report, no prior flat-loan
 * prepayment behaviour existed — `assertPrepayable` rejected every non-
 * anuitas loan): "reduce_installment" recomputes a fresh flat installment on
 * the REMAINING principal over the SAME remaining tenor (the prepaid balance
 * becomes the new base flat interest accrues on); "reduce_tenor"/"full" keep
 * the ORIGINAL installment (interest still on the untouched original
 * principal) and shorten the tenor to whatever that installment clears.
 */
function flatReduceInstallment(
  input: PrepaymentInput,
  base: ScheduleInput,
  balanceAfter: bigint,
): AfterState {
  const remainingMonths = input.schedule.remainingMonths;
  if (remainingMonths === null) {
    throw new RangeError("flat prepayment needs a tenor");
  }
  const ratePercent = rateAt(
    ratePlanOf(input.schedule),
    input.schedule.firstPeriod,
  ).ratePercent;
  const newInstallment = computeInstallment({
    method: "flat",
    principal: balanceAfter,
    annualInterestRatePercent: ratePercent,
    tenorMonths: remainingMonths,
  });
  const rows = buildSchedule({
    ...base,
    originalPrincipal: balanceAfter,
    installmentAmount: newInstallment,
    remainingMonths,
  });
  return { rows, newInstallmentAmount: newInstallment, newTenorMonths: null };
}

function afterState(input: PrepaymentInput, balanceAfter: bigint): AfterState {
  if (balanceAfter === 0n) {
    return { rows: [], newInstallmentAmount: null, newTenorMonths: null };
  }
  const method = input.schedule.method;
  const base = { ...input.schedule, remainingBalance: balanceAfter };
  if (input.mode === "reduce_installment") {
    if (method === "flat")
      return flatReduceInstallment(input, base, balanceAfter);
    const rows = buildSchedule({ ...base, recomputeAtStart: true });
    return {
      rows,
      newInstallmentAmount: rows[0]?.installment ?? null,
      newTenorMonths: null,
    };
  }
  const installment = currentInstallment(input.schedule);
  const months =
    installment === null
      ? null
      : monthsToPayOff(
          balanceAfter,
          rateAt(ratePlanOf(input.schedule), input.schedule.firstPeriod)
            .ratePercent,
          installment,
          method,
          method === "flat" ? input.schedule.originalPrincipal : undefined,
        );
  if (installment === null || months === null) {
    throw new RangeError("installment never pays off the balance");
  }
  return {
    rows: buildSchedule({
      ...base,
      installmentAmount: installment,
      remainingMonths: months,
      recomputeAtStart: false,
    }),
    newInstallmentAmount: installment,
    newTenorMonths: input.schedule.firstPeriod - 1 + months,
  };
}

/**
 * Prepays `amount` of principal right before the next installment
 * (`schedule.firstPeriod`); accrued interest since the last installment is
 * not modelled (monthly rest).
 */
export function simulatePrepayment(input: PrepaymentInput): PrepaymentResult {
  const balance = input.schedule.remainingBalance;
  const prepaid = input.mode === "full" ? balance : input.amount;
  if (prepaid <= 0n || prepaid > balance) {
    throw new RangeError("prepayment must be > 0 and <= the remaining balance");
  }
  const before = buildSchedule(input.schedule);
  const after = afterState(input, balance - prepaid);
  const penalty = prepaymentPenalty(prepaid, input.penaltyPercent);
  const totalInterestBefore = totalInterest(before);
  const totalInterestAfter = totalInterest(after.rows);
  const interestSaved = totalInterestBefore - totalInterestAfter;
  return {
    mode: prepaid === balance ? "full" : input.mode,
    prepaidPrincipal: prepaid,
    penalty,
    cashOutNow: prepaid + penalty,
    installmentBefore: before[0]?.installment ?? null,
    installmentAfter: after.rows[0]?.installment ?? null,
    remainingMonthsBefore: before.length,
    remainingMonthsAfter: after.rows.length,
    totalInterestBefore,
    totalInterestAfter,
    interestSaved,
    netSaving: interestSaved - penalty,
    newInstallmentAmount: after.newInstallmentAmount,
    newTenorMonths: after.newTenorMonths,
  };
}
