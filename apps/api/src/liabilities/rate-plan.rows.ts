import { type TxClient } from "../common/utils/serializable-retry.util";

import { effectivePeriodFor } from "./amortisation.util";
import {
  legacyRatePlan,
  type RatePeriodKind,
  type RatePlan,
  type RateSegment,
} from "./rate-plan.util";

export interface RatePeriodRow {
  liabilityId: string;
  sequence: number;
  kind: RatePeriodKind;
  months: number | null;
  ratePercent: { toString(): string };
}

export interface FloatingRateRow {
  id: string;
  liabilityId: string;
  effectiveDate: Date;
  ratePercent: { toString(): string };
  note: string | null;
  createdAt: Date;
}

export interface RatePlanRows {
  ratePeriods: RatePeriodRow[];
  floatingRates: FloatingRateRow[];
}

export const EMPTY_RATE_PLAN_ROWS: RatePlanRows = {
  ratePeriods: [],
  floatingRates: [],
};

export type RatePlanClient = Pick<
  TxClient,
  "liabilityRatePeriod" | "liabilityFloatingRate"
>;

export interface RatePlanTerms {
  interestRate: { toString(): string };
  fixedRateMonths: number | null;
  floatingRate: { toString(): string } | null;
  startDate: Date | null;
}

/** K rows for many liabilities: two queries total, both tenant-scoped. */
export async function loadRatePlanRows(
  client: RatePlanClient,
  familyGroupId: string,
  liabilityIds: string[],
): Promise<Map<string, RatePlanRows>> {
  if (liabilityIds.length === 0) return new Map();
  const where = { familyGroupId, liabilityId: { in: liabilityIds } };
  const [ratePeriods, floatingRates] = await Promise.all([
    client.liabilityRatePeriod.findMany({
      where,
      orderBy: [{ liabilityId: "asc" }, { sequence: "asc" }],
    }),
    client.liabilityFloatingRate.findMany({
      where,
      orderBy: [{ liabilityId: "asc" }, { effectiveDate: "asc" }],
    }),
  ]);
  return new Map(
    liabilityIds.map((id) => [
      id,
      {
        ratePeriods: ratePeriods.filter((row) => row.liabilityId === id),
        floatingRates: floatingRates.filter((row) => row.liabilityId === id),
      },
    ]),
  );
}

/** K's stored plan; undefined when the liability has no K rows, so G's legacy columns apply unchanged. */
export function ratePlanFromRows(
  rows: RatePlanRows,
  terms: RatePlanTerms,
): RatePlan | undefined {
  if (rows.ratePeriods.length === 0 && rows.floatingRates.length === 0) {
    return undefined;
  }
  const segments: RateSegment[] =
    rows.ratePeriods.length > 0
      ? [...rows.ratePeriods]
          .sort((a, b) => a.sequence - b.sequence)
          .map((row) => ({
            kind: row.kind,
            months: row.months,
            ratePercent: row.ratePercent.toString(),
          }))
      : legacyRatePlan(
          terms.interestRate.toString(),
          terms.fixedRateMonths,
          terms.floatingRate?.toString() ?? null,
        ).segments;
  const start = terms.startDate;
  // Stable sorts: two dates landing on the same period keep date order, so the later one wins.
  const floatingChanges =
    start === null
      ? []
      : [...rows.floatingRates]
          .sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime())
          .map((row) => ({
            effectivePeriod: effectivePeriodFor(start, row.effectiveDate),
            ratePercent: row.ratePercent.toString(),
          }))
          .sort((a, b) => a.effectivePeriod - b.effectivePeriod);
  return { segments, floatingChanges };
}
