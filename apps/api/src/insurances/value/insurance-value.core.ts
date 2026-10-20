import type { Prisma } from "@prisma/client";

/**
 * Asuransi S5/S6 — the ONE policy-value formula (pure, no I/O). Used by the
 * valuations API (computedValue/warning), the summary and the net-worth
 * helper, so every surface agrees on the same number.
 */
type Dec = Prisma.Decimal;

export interface ValuationRow {
  id: string;
  fundId: string | null;
  currency: string;
  units: Dec | null;
  navPerUnit: Dec | null;
  navDate: Date | null;
  unitsDate: Date | null;
  reportedValue: Dec | null;
  cashValue: Dec | null;
  effectiveDate: Date;
  source: string;
  status: string;
  createdAt: Date;
}

export type ValuationWarning = "dates_incompatible" | "incomplete" | null;

/**
 * units × NAV only when both exist and their dates are compatible (equal
 * when both are given). A missing NAV/units is never treated as zero.
 */
export function computeUnitValue(row: {
  units: Dec | null;
  navPerUnit: Dec | null;
  navDate: Date | null;
  unitsDate: Date | null;
}): { computedValue: Dec | null; warning: ValuationWarning } {
  const { units, navPerUnit, navDate, unitsDate } = row;
  if (units === null && navPerUnit === null) {
    return { computedValue: null, warning: null };
  }
  if (units === null || navPerUnit === null) {
    return { computedValue: null, warning: "incomplete" };
  }
  if (
    navDate &&
    unitsDate &&
    navDate.toISOString().slice(0, 10) !== unitsDate.toISOString().slice(0, 10)
  ) {
    return { computedValue: null, warning: "dates_incompatible" };
  }
  return {
    computedValue: units.times(navPerUnit).toDecimalPlaces(4),
    warning: null,
  };
}

/**
 * The value one statement stands for: the reported policy/fund value, else
 * units × NAV, else the reported cash value (traditional). A row never holds
 * both reportedValue and units+NAV (DB CHECK + service validation).
 * Surrender estimate and maturity benefit are NOT current value.
 */
export function statementValue(row: ValuationRow): Dec | null {
  if (row.reportedValue !== null) return row.reportedValue;
  const { computedValue } = computeUnitValue(row);
  if (computedValue !== null) return computedValue;
  return row.cashValue;
}

export interface PolicyValueComponent {
  fundId: string | null;
  currency: string;
  value: Dec;
  effectiveDate: Date;
  source: string;
  valuationId: string;
}

function newerFirst(a: ValuationRow, b: ValuationRow): number {
  const d = b.effectiveDate.getTime() - a.effectiveDate.getTime();
  return d !== 0 ? d : b.createdAt.getTime() - a.createdAt.getTime();
}

function latestValued(rows: ValuationRow[]): PolicyValueComponent | null {
  for (const row of [...rows].sort(newerFirst)) {
    const value = statementValue(row);
    if (value !== null) {
      return {
        fundId: row.fundId,
        currency: row.currency,
        value,
        effectiveDate: row.effectiveDate,
        source: row.source,
        valuationId: row.id,
      };
    }
  }
  return null;
}

/**
 * The CONFIRMED value of a policy, counted once:
 * - per fund: the latest confirmed statement by effectiveDate that has a
 *   value (a backdated upload never overrides a newer one; an unusable
 *   newest row keeps the older value and its older date);
 * - policy level (fundId null): the latest confirmed statement with a value;
 * - fund rows and a policy-level total are two representations of the same
 *   money — whichever is newer wins, never both.
 * Returns one component per fund (each in its own currency) or the single
 * policy-level component; [] when nothing confirmed exists.
 */
export function confirmedPolicyValue(
  rows: ValuationRow[],
): PolicyValueComponent[] {
  const confirmed = rows.filter((r) => r.status === "confirmed");
  const byFund = new Map<string, ValuationRow[]>();
  for (const r of confirmed) {
    if (!r.fundId) continue;
    byFund.set(r.fundId, [...(byFund.get(r.fundId) ?? []), r]);
  }
  const funds = [...byFund.values()]
    .map(latestValued)
    .filter((c): c is PolicyValueComponent => c !== null);
  const policyLevel = latestValued(confirmed.filter((r) => !r.fundId));

  if (funds.length === 0) return policyLevel ? [policyLevel] : [];
  const newestFund = Math.max(...funds.map((f) => f.effectiveDate.getTime()));
  if (policyLevel && policyLevel.effectiveDate.getTime() > newestFund) {
    return [policyLevel];
  }
  return funds;
}
