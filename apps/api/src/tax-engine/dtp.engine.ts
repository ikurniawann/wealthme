import { monthStartDate, ruleAt } from "../tax-rules/tax-rules.registry";

import type { DtpSector, TaxRuleRef } from "../tax-rules/tax-rule.types";

export type DtpEmployment = "permanent" | "non_permanent";
export type DtpReason =
  | "no_program"
  | "sector_not_covered"
  | "gross_above_cap"
  | "daily_wage_above_cap"
  | "nik_not_validated";
export interface DtpProfile {
  sector: DtpSector | null;
  employment: DtpEmployment;
  dailyWage: bigint | null;
  nikValidated: boolean;
}

function assertMonth(month: number): void {
  if (!Number.isInteger(month) || month < 1 || month > 12)
    throw new RangeError("month must be 1..12");
}
function assertNonNegative(name: string, value: bigint): void {
  if (value < 0n) throw new RangeError(`${name} must be >= 0`);
}

export function dtpEligibility(args: {
  taxYear: number;
  month: number;
  monthlyGross: bigint;
  /** PMK 10/2025, 105/2025: the cap is checked against fixed/regular salary,
   * not total gross incl. THR/bonus. Defaults to monthlyGross. */
  fixedMonthlyGross?: bigint;
  profile: DtpProfile;
}): { eligible: boolean; reasons: DtpReason[]; ref: TaxRuleRef } {
  assertMonth(args.month);
  assertNonNegative("monthlyGross", args.monthlyGross);
  if (args.fixedMonthlyGross !== undefined)
    assertNonNegative("fixedMonthlyGross", args.fixedMonthlyGross);
  const capGross = args.fixedMonthlyGross ?? args.monthlyGross;
  const { value, ref } = ruleAt(
    "pph21.dtp",
    monthStartDate(args.taxYear, args.month),
  );
  if (value.sectors.length === 0)
    return { eligible: false, reasons: ["no_program"], ref };
  const reasons: DtpReason[] = [];
  const { profile } = args;
  if (profile.sector === null || !value.sectors.includes(profile.sector))
    reasons.push("sector_not_covered");
  if (profile.employment === "permanent") {
    if (capGross > value.permanentMaxMonthlyGross)
      reasons.push("gross_above_cap");
  } else {
    const dailyOk =
      profile.dailyWage !== null &&
      profile.dailyWage <= value.nonPermanentMaxDailyWage;
    const monthlyOk =
      value.nonPermanentMaxMonthlyGross !== null &&
      capGross <= value.nonPermanentMaxMonthlyGross;
    if (!dailyOk && !monthlyOk) reasons.push("daily_wage_above_cap");
  }
  if (value.requiresValidatedNik && !profile.nikValidated)
    reasons.push("nik_not_validated");
  return { eligible: reasons.length === 0, reasons, ref };
}
