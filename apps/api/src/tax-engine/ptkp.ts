import { ruleAt } from "../tax-rules/tax-rules.registry";

import type { TaxRuleRef } from "../tax-rules/tax-rule.types";

export type MaritalStatus = "TK" | "K" | "KI";
export interface TaxStatus {
  maritalStatus: MaritalStatus;
  dependents: number;
}

export function ptkpFor(
  status: TaxStatus,
  date: string,
): { ptkp: bigint; ref: TaxRuleRef } {
  const { value, ref } = ruleAt("pph.ptkp", date);
  const d = status.dependents;
  if (!Number.isInteger(d) || d < 0 || d > value.maxDependents) {
    throw new RangeError(`dependents must be 0..${value.maxDependents}`);
  }
  const married = status.maritalStatus === "TK" ? 0n : value.marriedAddOn;
  const wife =
    status.maritalStatus === "KI" ? value.combinedWifeIncomeAddOn : 0n;
  return {
    ptkp: value.base + married + wife + BigInt(d) * value.dependentAddOn,
    ref,
  };
}
