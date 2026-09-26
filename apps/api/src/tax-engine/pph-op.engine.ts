import {
  ruleAt,
  uniqueRefs,
  yearEndDate,
} from "../tax-rules/tax-rules.registry";

import { divHalfUp, floorTo } from "./money";
import { ptkpFor } from "./ptkp";

import type { TaxStatus } from "./ptkp";
import type { TaxRuleRef } from "../tax-rules/tax-rule.types";

export interface PphOpInput {
  taxYear: number;
  status: TaxStatus | null;
  ptkpOverride?: bigint;
  employmentGross: bigint;
  pensionContribution: bigint;
  freelance: { gross: bigint; nppnBps: number } | null;
  otherNetIncome: bigint;
  zakat: bigint;
  withheldPph21: bigint;
}

export interface PphOpBracket {
  from: bigint;
  upTo: bigint | null;
  rateBps: number;
  label: string;
  taxable: bigint;
  tax: bigint;
}

export interface PphOpResult {
  taxYear: number;
  ptkp: bigint;
  biayaJabatanHundredths: bigint;
  biayaJabatan: bigint;
  pensionDeduction: bigint;
  freelanceNet: bigint;
  neto: bigint;
  zakatApplied: bigint;
  pkp: bigint;
  brackets: PphOpBracket[];
  tax: bigint;
  withheld: bigint;
  balance: bigint;
  rules: TaxRuleRef[];
}

const min = (a: bigint, b: bigint) => (a < b ? a : b);
const max = (a: bigint, b: bigint) => (a > b ? a : b);

export function pasal17Tax(pkp: bigint, date: string) {
  const { value, ref } = ruleAt("pph.pasal17", date);
  const brackets: PphOpBracket[] = [];
  let prev = 0n;
  for (const band of value) {
    if (pkp <= prev) break;
    const top = band.upTo === null || pkp < band.upTo ? pkp : band.upTo;
    const taxable = top - prev;
    brackets.push({
      from: prev,
      upTo: band.upTo,
      rateBps: band.rateBps,
      label: band.label,
      taxable,
      tax: divHalfUp(taxable * BigInt(band.rateBps), 10_000n),
    });
    if (band.upTo === null) break;
    prev = band.upTo;
  }
  return { brackets, tax: brackets.reduce((s, b) => s + b.tax, 0n), ref };
}

export function computePphOp(input: PphOpInput): PphOpResult {
  const date = yearEndDate(input.taxYear);
  const refs: TaxRuleRef[] = [];

  let ptkp: bigint;
  if (input.status) {
    const p = ptkpFor(input.status, date);
    ptkp = p.ptkp;
    refs.push(p.ref);
  } else if (input.ptkpOverride !== undefined) {
    ptkp = input.ptkpOverride;
  } else {
    throw new RangeError("status or ptkpOverride is required");
  }

  const bj = ruleAt("pph.biayaJabatan", date);
  refs.push(bj.ref);
  const gross100 = input.employmentGross * 100n;
  const bj100 = min(
    (input.employmentGross * BigInt(bj.value.rateBps)) / 100n,
    bj.value.capAnnual * 100n,
  );
  const pension100 = min(
    input.pensionContribution * 100n,
    max(0n, gross100 - bj100),
  );
  const employmentNet100 = max(0n, gross100 - bj100 - pension100);

  let freelanceNet = 0n;
  if (input.freelance) {
    const { gross, nppnBps } = input.freelance;
    if (!Number.isInteger(nppnBps) || nppnBps < 1 || nppnBps > 10_000) {
      throw new RangeError("nppnBps must be 1..10000");
    }
    freelanceNet = divHalfUp(gross * BigInt(nppnBps), 10_000n);
    refs.push(ruleAt("pph.nppn", date).ref);
  }

  const neto100 =
    employmentNet100 + freelanceNet * 100n + input.otherNetIncome * 100n;
  const zakatRule = ruleAt("pph.zakat", date);
  refs.push(zakatRule.ref);
  const zakat100 = min(input.zakat * 100n, neto100);

  const rounding = ruleAt("pph.pkpRounding", date);
  refs.push(rounding.ref);
  const pkp = floorTo(
    (neto100 - zakat100 - ptkp * 100n) / 100n,
    rounding.value.unit,
  );

  const p17 = pasal17Tax(pkp, date);
  refs.push(p17.ref);

  return {
    taxYear: input.taxYear,
    ptkp,
    biayaJabatanHundredths: bj100,
    biayaJabatan: divHalfUp(bj100, 100n),
    pensionDeduction: divHalfUp(pension100, 100n),
    freelanceNet,
    neto: divHalfUp(neto100, 100n),
    zakatApplied: divHalfUp(zakat100, 100n),
    pkp,
    brackets: p17.brackets,
    tax: p17.tax,
    withheld: input.withheldPph21,
    balance: p17.tax - input.withheldPph21,
    rules: uniqueRefs(refs),
  };
}

export function computeLegacyNetTax(
  gross: bigint,
  ptkp: bigint,
  zakat: bigint,
  taxYear: number,
): bigint {
  return computePphOp({
    taxYear,
    status: null,
    ptkpOverride: ptkp,
    employmentGross: gross,
    pensionContribution: 0n,
    freelance: null,
    otherNetIncome: 0n,
    zakat,
    withheldPph21: 0n,
  }).tax;
}
