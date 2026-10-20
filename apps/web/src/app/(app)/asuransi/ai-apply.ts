import { canonicalToTyping } from "@/components/money";

import {
  FORM_PERIODS,
  NAV_DECIMALS,
  POLICY_CURRENCIES,
  UNIT_DECIMALS,
  VALUE_DECIMALS,
  emptyBenefit,
  emptyFund,
  newRowId,
  type FundRow,
  type PolicyFormState,
} from "./policy-form-model";

import type { AiApplyPayload } from "./ai-review";
import type { PremiumPeriod } from "@wealthme/contracts";

const isCurrency = (v: string) =>
  (POLICY_CURRENCIES as readonly string[]).includes(v);

/**
 * Maps reviewed AI fields + value drafts onto the form. Only what the user
 * kept is applied; fund lines arrive as "Perlu konfirmasi" with their page
 * and snippet. Returns the next form state and, when the report printed a
 * premium, the premium in its currency for the money field.
 */
export function applyAiToForm(
  state: PolicyFormState,
  { fields, drafts }: AiApplyPayload,
): {
  next: PolicyFormState;
  premium: { raw: string; currency: string } | null;
} {
  const next: PolicyFormState = {
    ...state,
    benefits: [...state.benefits],
    insured: [...state.insured],
  };
  let premium: { raw: string; currency: string } | null = null;
  const currency = fields
    .find((f) => f.key === "currency")
    ?.value.toUpperCase();
  if (currency && isCurrency(currency)) next.currency = currency;

  for (const f of fields) {
    switch (f.key) {
      case "productName":
        next.name = f.value;
        break;
      case "provider":
        next.provider = f.value;
        break;
      case "policyNumber":
        next.policyNumber = f.value;
        break;
      case "policyType":
        if (f.value === "traditional" || f.value === "unit_link")
          next.policyType = f.value;
        break;
      case "holderName":
        next.holderUserId = "";
        next.holderName = f.value;
        break;
      case "insuredName":
        if (
          !next.insured.some(
            (i) => i.name.toLowerCase() === f.value.toLowerCase(),
          )
        )
          next.insured.push({
            rowId: newRowId("person"),
            memberUserId: "",
            name: f.value,
            relationship: "",
          });
        break;
      case "premiumAmount":
        premium = {
          raw: canonicalToTyping(f.value, next.currency === "IDR" ? 0 : 2),
          currency: next.currency,
        };
        break;
      case "premiumPeriod":
        if (FORM_PERIODS.includes(f.value as PremiumPeriod))
          next.premiumPeriod = f.value as PremiumPeriod;
        break;
      case "sumAssured": {
        const first =
          next.benefits[0] ?? emptyBenefit("life_sum_assured", next.currency);
        next.benefits[0] = {
          ...first,
          raw: canonicalToTyping(f.value, next.currency === "IDR" ? 0 : 2),
          currency: next.currency,
        };
        break;
      }
      case "coverageStartDate":
        next.coverageStartDate = f.value;
        break;
      case "coverageEndDate":
        next.coverageEndDate = f.value;
        break;
      case "nextPremiumDueDate":
        next.nextPremiumDueDate = f.value;
        break;
      default:
        break;
    }
  }

  const fundDrafts = drafts.filter((d) => d.units || d.navPerUnit || d.fund);
  if (fundDrafts.length > 0) {
    next.policyType = next.policyType || "unit_link";
    const funds = [...next.funds];
    for (const d of fundDrafts) {
      const at = funds.findIndex(
        (f) =>
          (d.fundId && f.fundId === d.fundId) ||
          (d.fund && f.name.toLowerCase() === d.fund.toLowerCase()),
      );
      const base: FundRow =
        at >= 0
          ? funds[at]
          : { ...emptyFund(d.currency ?? next.currency), name: d.fund ?? "" };
      const row: FundRow = {
        ...base,
        units: d.units ? canonicalToTyping(d.units, UNIT_DECIMALS) : base.units,
        nav: d.navPerUnit
          ? canonicalToTyping(d.navPerUnit, NAV_DECIMALS)
          : base.nav,
        navDate: d.navDate ?? d.effectiveDate ?? base.navDate,
        unitsDate: d.unitsDate ?? "",
        confirmed: false,
        page: d.page ?? 1,
        snippet: d.snippet,
      };
      if (at >= 0) funds[at] = row;
      else funds.push(row);
    }
    next.funds = funds;
  }
  const policyDraft = drafts.find(
    (d) =>
      !d.fund &&
      !d.units &&
      (d.cashValue || d.reportedValue || d.surrenderEstimate),
  );
  if (policyDraft && next.policyType === "traditional") {
    const money = (v: string | null) =>
      v ? canonicalToTyping(v, VALUE_DECIMALS) : "";
    next.cash = {
      ...next.cash,
      cashValue: money(policyDraft.cashValue ?? policyDraft.reportedValue),
      surrenderEstimate: money(policyDraft.surrenderEstimate),
      maturityBenefit: money(policyDraft.maturityBenefit),
      effectiveDate: policyDraft.effectiveDate ?? "",
      confirmed: false,
    };
  }
  return { next, premium };
}
