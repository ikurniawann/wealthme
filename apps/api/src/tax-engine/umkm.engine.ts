import {
  monthStartDate,
  ruleAt,
  uniqueRefs,
  yearEndDate,
} from "../tax-rules/tax-rules.registry";

import { applyBps } from "./money";

import type { TaxRuleRef } from "../tax-rules/tax-rule.types";

export interface UmkmMonth {
  month: number;
  omzet: bigint;
  cumulative: bigint;
  taxable: bigint;
  tax: bigint | null;
  eligible: boolean;
}
export interface UmkmResult {
  months: UmkmMonth[];
  totalOmzet: bigint;
  totalTax: bigint;
  exceedsCeiling: boolean;
  ineligibleReason: "time_limit" | null;
  rules: TaxRuleRef[];
}

export function umkmYear(input: {
  taxYear: number;
  monthlyOmzet: readonly bigint[];
  firstRegisteredYear: number | null;
}): UmkmResult {
  if (input.monthlyOmzet.length !== 12)
    throw new RangeError("monthlyOmzet needs 12 entries");
  const refs: TaxRuleRef[] = [];
  const months: UmkmMonth[] = [];
  let cumulative = 0n;
  let totalTax = 0n;
  let exceedsCeiling = false;

  // The 0,5% individual time limit is a per-tax-year fact (PP 20/2026 removes it
  // outright for the year in force), not a per-month one — resolve it once at
  // year-end instead of re-deriving it (and risking a mid-year flip) per month.
  const { value: yearValue, ref: yearRef } = ruleAt(
    "umkm.final",
    yearEndDate(input.taxYear),
  );
  refs.push(yearRef);
  const limit = yearValue.individualTimeLimitYears;
  const eligible = !(
    limit !== null &&
    input.firstRegisteredYear !== null &&
    input.taxYear >= input.firstRegisteredYear + limit
  );
  const ineligibleReason: "time_limit" | null = eligible ? null : "time_limit";

  input.monthlyOmzet.forEach((omzet, i) => {
    const month = i + 1;
    const { value, ref } = ruleAt(
      "umkm.final",
      monthStartDate(input.taxYear, month),
    );
    refs.push(ref);
    const before = cumulative;
    cumulative += omzet;
    if (cumulative > value.turnoverCeiling) exceedsCeiling = true;
    if (!eligible) {
      months.push({
        month,
        omzet,
        cumulative,
        taxable: 0n,
        tax: null,
        eligible,
      });
      return;
    }
    const ex = value.individualExemption;
    const taxable =
      cumulative <= ex ? 0n : before >= ex ? omzet : cumulative - ex;
    const tax = applyBps(taxable, value.rateBps);
    totalTax += tax;
    months.push({ month, omzet, cumulative, taxable, tax, eligible });
  });

  return {
    months,
    totalOmzet: cumulative,
    totalTax,
    exceedsCeiling,
    ineligibleReason,
    rules: uniqueRefs(refs),
  };
}
