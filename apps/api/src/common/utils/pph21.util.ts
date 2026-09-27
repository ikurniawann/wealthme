import { ruleAt, wibDateString } from "../../tax-rules/tax-rules.registry";

// Float path kept only for the public POST /calculators/pph21 (IsNumber input). `bps / 10_000`
// yields the same doubles as the old rate literals, so responses stay byte-identical.
const today = () => wibDateString(new Date());

export interface Pph21BracketTax {
  bracket: string;
  taxableAmount: number;
  rate: number;
  tax: number;
}

export function pph21DefaultPtkp(date: string = today()): number {
  return Number(ruleAt("pph.ptkp", date).value.base);
}

export function roundPkpDown(pkpRaw: number, date: string = today()): number {
  const unit = Number(ruleAt("pph.pkpRounding", date).value.unit);
  return Math.floor(Math.max(0, pkpRaw) / unit) * unit;
}

export function computePkp(
  grossIncome: number,
  ptkp: number,
  zakatDeduction = 0,
  date: string = today(),
): { biayaJabatan: number; pkp: number } {
  const bj = ruleAt("pph.biayaJabatan", date).value;
  const biayaJabatan = Math.min(
    grossIncome * (bj.rateBps / 10_000),
    Number(bj.capAnnual),
  );
  const pkpRaw = grossIncome - biayaJabatan - ptkp - zakatDeduction;
  return { biayaJabatan, pkp: roundPkpDown(pkpRaw, date) };
}

export function computeTaxBrackets(
  pkp: number,
  date: string = today(),
): Pph21BracketTax[] {
  const breakdown: Pph21BracketTax[] = [];
  let remaining = pkp;
  let previousLimit = 0;
  for (const band of ruleAt("pph.pasal17", date).value) {
    if (remaining <= 0) break;
    const limit = band.upTo === null ? Infinity : Number(band.upTo);
    const rate = band.rateBps / 10_000;
    const taxableAmount =
      limit === Infinity
        ? remaining
        : Math.min(remaining, limit - previousLimit);
    breakdown.push({
      bracket: band.label,
      taxableAmount,
      rate,
      tax: taxableAmount * rate,
    });
    remaining -= taxableAmount;
    previousLimit = limit;
  }
  return breakdown;
}

export function sumTaxRounded(breakdown: readonly Pph21BracketTax[]): number {
  return Math.round(breakdown.reduce((sum, b) => sum + b.tax, 0));
}
