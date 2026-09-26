/**
 * Revisi K — early-repayment (pelunasan dipercepat) simulation. Read-only:
 * it reuses buildSchedule for both the "before" and "after" projections, so
 * no installment math lives here.
 */
import {
  buildSchedule,
  currentInstallment,
  parseRateScaledByHundred,
  ratePlanOf,
  roundHalfUpDivide,
  type ScheduleInput,
  type ScheduleRow,
} from "./amortisation.util";
import { rateAt } from "./rate-plan.util";

export type PrepaymentMode = "full" | "reduce_tenor" | "reduce_installment";

// (percent scale 100) * (fixed-point scale 100)
const PERCENT_DENOMINATOR = 10_000n;

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

/** Months a level `installment` needs to clear `balance` at a constant annual rate; null if it never does. */
export function monthsToPayOff(
  balance: bigint,
  annualRatePercent: string,
  installment: bigint,
): number | null {
  const rows = buildSchedule({
    method: "anuitas",
    remainingBalance: balance,
    originalPrincipal: balance,
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

function afterState(input: PrepaymentInput, balanceAfter: bigint): AfterState {
  if (balanceAfter === 0n) {
    return { rows: [], newInstallmentAmount: null, newTenorMonths: null };
  }
  const base = { ...input.schedule, remainingBalance: balanceAfter };
  if (input.mode === "reduce_installment") {
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
