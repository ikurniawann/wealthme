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

export function dtpEligibility(args: {
  taxYear: number;
  month: number;
  monthlyGross: bigint;
  profile: DtpProfile;
}): { eligible: boolean; reasons: DtpReason[]; ref: TaxRuleRef } {
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
    if (args.monthlyGross > value.permanentMaxMonthlyGross)
      reasons.push("gross_above_cap");
  } else {
    const dailyOk =
      profile.dailyWage !== null &&
      profile.dailyWage <= value.nonPermanentMaxDailyWage;
    const monthlyOk =
      value.nonPermanentMaxMonthlyGross !== null &&
      args.monthlyGross <= value.nonPermanentMaxMonthlyGross;
    if (!dailyOk && !monthlyOk) reasons.push("daily_wage_above_cap");
  }
  if (value.requiresValidatedNik && !profile.nikValidated)
    reasons.push("nik_not_validated");
  return { eligible: reasons.length === 0, reasons, ref };
}
