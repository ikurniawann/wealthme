/**
 * Revisi K — a KPR's rate plan: ordered rate periods (fixed tiers, then an
 * optional floating tail) plus the floating-rate changes the user recorded.
 * Pure data + lookups; the money math stays in amortisation.util.ts.
 */

export type RatePeriodKind = "fixed" | "floating";

export interface RateSegment {
  kind: RatePeriodKind;
  /** Installments this segment covers; null = runs to maturity (last segment only). */
  months: number | null;
  ratePercent: string;
}

export interface FloatingRateChange {
  /** First installment period that accrues at `ratePercent` (see effectivePeriodFor). */
  effectivePeriod: number;
  ratePercent: string;
}

export interface RatePlan {
  segments: RateSegment[];
  /** Sorted by effectivePeriod ascending, no duplicates. */
  floatingChanges: FloatingRateChange[];
}

export interface ResolvedRate {
  ratePercent: string;
  kind: RatePeriodKind;
  segmentIndex: number;
  /** Index of the applied floating change, -1 when the segment's own rate applies. */
  changeIndex: number;
}

/** G's single fixedRateMonths + floatingRate pair, read as a two-segment plan. */
export function legacyRatePlan(
  baseRatePercent: string,
  fixedRateMonths: number | null,
  floatingRatePercent: string | null,
): RatePlan {
  if (fixedRateMonths !== null && floatingRatePercent !== null) {
    return {
      segments: [
        {
          kind: "fixed",
          months: fixedRateMonths,
          ratePercent: baseRatePercent,
        },
        { kind: "floating", months: null, ratePercent: floatingRatePercent },
      ],
      floatingChanges: [],
    };
  }
  return {
    segments: [{ kind: "fixed", months: null, ratePercent: baseRatePercent }],
    floatingChanges: [],
  };
}

/** 1-based first period of each segment, e.g. [24, 12, null] -> [1, 25, 37]. */
export function segmentStartPeriods(plan: RatePlan): number[] {
  const starts: number[] = [];
  let start = 1;
  for (const segment of plan.segments) {
    starts.push(start);
    start += segment.months ?? 0;
  }
  return starts;
}

export function segmentIndexAt(plan: RatePlan, period: number): number {
  let start = 1;
  for (const [index, segment] of plan.segments.entries()) {
    if (segment.months === null || period < start + segment.months) {
      return index;
    }
    start += segment.months;
  }
  return plan.segments.length - 1;
}

/**
 * The rate installment `period` accrues at. Inside a floating segment the
 * latest recorded change with effectivePeriod <= period wins, including one
 * recorded while the loan was still fixed (it is the bank rate in force when
 * floating starts); fixed segments ignore recorded changes.
 */
export function rateAt(plan: RatePlan, period: number): ResolvedRate {
  const segmentIndex = segmentIndexAt(plan, period);
  const segment = plan.segments[segmentIndex];
  if (!segment) throw new Error("rate plan has no segments");
  if (segment.kind === "fixed") {
    return {
      ratePercent: segment.ratePercent,
      kind: "fixed",
      segmentIndex,
      changeIndex: -1,
    };
  }
  let changeIndex = -1;
  for (const [index, change] of plan.floatingChanges.entries()) {
    if (change.effectivePeriod <= period) changeIndex = index;
  }
  return {
    ratePercent:
      plan.floatingChanges[changeIndex]?.ratePercent ?? segment.ratePercent,
    kind: "floating",
    segmentIndex,
    changeIndex,
  };
}

/** True when two periods sit under the same segment AND the same recorded change. */
export function sameRateRegime(a: ResolvedRate, b: ResolvedRate): boolean {
  return a.segmentIndex === b.segmentIndex && a.changeIndex === b.changeIndex;
}

export function hasFloatingSegment(plan: RatePlan): boolean {
  return plan.segments.some((segment) => segment.kind === "floating");
}
