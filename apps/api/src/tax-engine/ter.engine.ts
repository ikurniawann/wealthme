import {
  monthStartDate,
  ruleAt,
  uniqueRefs,
} from "../tax-rules/tax-rules.registry";

import { dtpEligibility } from "./dtp.engine";
import { applyBps } from "./money";
import { computePphOp } from "./pph-op.engine";

import type { DtpProfile, DtpReason } from "./dtp.engine";
import type { TaxStatus } from "./ptkp";
import type { TaxRuleRef, TerCategory } from "../tax-rules/tax-rule.types";

export class TerNotApplicableError extends Error {
  constructor(taxYear: number) {
    super(`TER berlaku mulai 2024 (tahun pajak ${taxYear})`);
  }
}

export interface TerYearInput {
  taxYear: number;
  status: TaxStatus;
  monthlyGross: readonly bigint[]; // length 12, Jan..Dec
  monthlyPension: readonly bigint[]; // length 12
  zakat: bigint;
  dtp: DtpProfile | null;
}
export interface TerMonth {
  month: number;
  gross: bigint;
  category: TerCategory;
  rateBps: number | null; // null for December (true-up month)
  withholding: bigint; // December: the true-up, may be negative
  dtp: { eligible: boolean; reasons: DtpReason[]; amount: bigint } | null;
}
export interface TerYearResult {
  category: TerCategory;
  months: TerMonth[];
  annualTax: bigint;
  withheldJanNov: bigint;
  december: bigint;
  isRefund: boolean;
  dtpTotal: bigint;
  rules: TaxRuleRef[];
}

export function terCategoryFor(status: TaxStatus, date: string) {
  const { value, ref } = ruleAt("pph21.terCategoryMap", date);
  const row = value[status.maritalStatus === "TK" ? "TK" : "K"];
  const category = row[status.dependents];
  if (category === undefined) throw new RangeError("dependents must be 0..3");
  return { category, ref };
}

export function terMonthly(args: {
  taxYear: number;
  month: number;
  status: TaxStatus;
  monthlyGross: bigint;
}) {
  const date = monthStartDate(args.taxYear, args.month);
  const tables = ruleAt("pph21.terTables", date);
  if (tables.ref.outOfRange) throw new TerNotApplicableError(args.taxYear);
  const cat = terCategoryFor(args.status, date);
  const band = tables.value[cat.category].find(
    (b) => b.upTo === null || args.monthlyGross <= b.upTo,
  )!;
  return {
    category: cat.category,
    rateBps: band.rateBps,
    withholding: applyBps(args.monthlyGross, band.rateBps),
    rules: [tables.ref, cat.ref],
  };
}

export function terYear(input: TerYearInput): TerYearResult {
  if (input.monthlyGross.length !== 12 || input.monthlyPension.length !== 12) {
    throw new RangeError("monthlyGross and monthlyPension need 12 entries");
  }
  const refs: TaxRuleRef[] = [];
  const months: TerMonth[] = [];
  let withheldJanNov = 0n;
  let dtpTotal = 0n;
  let category: TerCategory = "A";

  const dtpFor = (month: number, gross: bigint, amount: bigint) => {
    if (!input.dtp) return null;
    const d = dtpEligibility({
      taxYear: input.taxYear,
      month,
      monthlyGross: gross,
      profile: input.dtp,
    });
    refs.push(d.ref);
    const dtpAmount = d.eligible && amount > 0n ? amount : 0n;
    dtpTotal += dtpAmount;
    return {
      eligible: d.eligible,
      reasons: d.reasons as DtpReason[],
      amount: dtpAmount,
    };
  };

  for (let month = 1; month <= 11; month++) {
    const gross = input.monthlyGross[month - 1]!;
    const m = terMonthly({
      taxYear: input.taxYear,
      month,
      status: input.status,
      monthlyGross: gross,
    });
    refs.push(...m.rules);
    category = m.category;
    withheldJanNov += m.withholding;
    months.push({
      month,
      gross,
      category: m.category,
      rateBps: m.rateBps,
      withholding: m.withholding,
      dtp: dtpFor(month, gross, m.withholding),
    });
  }

  const annual = computePphOp({
    taxYear: input.taxYear,
    status: input.status,
    employmentGross: input.monthlyGross.reduce((s, g) => s + g, 0n),
    pensionContribution: input.monthlyPension.reduce((s, p) => s + p, 0n),
    freelance: null,
    otherNetIncome: 0n,
    zakat: input.zakat,
    withheldPph21: withheldJanNov,
  });
  refs.push(...annual.rules);
  const december = annual.balance;
  const decGross = input.monthlyGross[11]!;
  months.push({
    month: 12,
    gross: decGross,
    category,
    rateBps: null,
    withholding: december,
    dtp: dtpFor(12, decGross, december),
  });

  return {
    category,
    months,
    annualTax: annual.tax,
    withheldJanNov,
    december,
    isRefund: december < 0n,
    dtpTotal,
    rules: uniqueRefs(refs),
  };
}
