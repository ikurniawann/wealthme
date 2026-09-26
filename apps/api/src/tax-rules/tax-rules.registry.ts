import { FINAL_RULES } from "./data/final.rules";
import { PPH_RULES } from "./data/pph.rules";
import { PPH21_RULES } from "./data/pph21.rules";

import type {
  AnyTaxRuleEntry,
  TaxRuleEntry,
  TaxRuleKey,
  TaxRuleRef,
  TaxRuleValueMap,
} from "./tax-rule.types";

export const TAX_RULES: readonly AnyTaxRuleEntry[] = [
  ...PPH_RULES,
  ...PPH21_RULES,
  ...FINAL_RULES,
];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export interface ResolvedRule<K extends TaxRuleKey> {
  value: TaxRuleValueMap[K];
  ref: TaxRuleRef;
}

function toRef(e: AnyTaxRuleEntry, outOfRange: boolean): TaxRuleRef {
  return {
    key: e.key,
    legalBasis: e.legalBasis,
    source: e.source,
    verified: e.verified,
    effectiveFrom: e.effectiveFrom,
    effectiveTo: e.effectiveTo,
    outOfRange,
    note: e.note ?? null,
  };
}

export function ruleAt<K extends TaxRuleKey>(
  key: K,
  date: string,
): ResolvedRule<K> {
  if (!DATE.test(date)) throw new RangeError(`bad rule date: ${date}`);
  const entries = TAX_RULES.filter((e) => e.key === key).sort((a, b) =>
    a.effectiveFrom.localeCompare(b.effectiveFrom),
  ) as unknown as TaxRuleEntry<K>[];
  const first = entries[0];
  if (!first) throw new Error(`no tax rule for ${key}`);
  const hit = entries.find(
    (e) =>
      e.effectiveFrom <= date &&
      (e.effectiveTo === null || date <= e.effectiveTo),
  );
  if (hit)
    return { value: hit.value, ref: toRef(hit as AnyTaxRuleEntry, false) };
  if (date < first.effectiveFrom)
    return { value: first.value, ref: toRef(first as AnyTaxRuleEntry, true) };
  throw new Error(`tax rule ${key} has no entry covering ${date}`);
}

export function listRuleRefs(
  date: string,
  keys?: readonly TaxRuleKey[],
): TaxRuleRef[] {
  const all = keys ?? [...new Set(TAX_RULES.map((e) => e.key))];
  return all.map((k) => ruleAt(k, date).ref);
}

export function uniqueRefs(refs: readonly TaxRuleRef[]): TaxRuleRef[] {
  const seen = new Map<string, TaxRuleRef>();
  for (const r of refs) seen.set(`${r.key}|${r.effectiveFrom}`, r);
  return [...seen.values()];
}

export const yearEndDate = (year: number) => `${year}-12-31`;
export const monthStartDate = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}-01`;
export const wibDateString = (d: Date) =>
  new Date(d.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
