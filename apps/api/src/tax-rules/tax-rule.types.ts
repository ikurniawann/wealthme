export type TerCategory = "A" | "B" | "C";
export type DtpSector =
  | "alas_kaki"
  | "tekstil_pakaian"
  | "furnitur"
  | "kulit"
  | "pariwisata";
export interface Fraction {
  num: bigint;
  den: bigint;
}

export interface Pasal17Band {
  upTo: bigint | null;
  rateBps: number;
  label: string;
}
export interface PtkpValue {
  base: bigint;
  marriedAddOn: bigint;
  dependentAddOn: bigint;
  maxDependents: number;
  combinedWifeIncomeAddOn: bigint;
}
export interface BiayaJabatanValue {
  rateBps: number;
  capAnnual: bigint;
  capMonthly: bigint;
}
export interface PkpRoundingValue {
  unit: bigint;
}
export interface ZakatValue {
  capToNeto: true;
}
export interface NppnValue {
  table: null;
}
export interface TerBand {
  upTo: bigint | null;
  rateBps: number;
}
export type TerTablesValue = Readonly<Record<TerCategory, readonly TerBand[]>>;
export type TerCategoryMapValue = Readonly<
  Record<
    "TK" | "K",
    readonly [TerCategory, TerCategory, TerCategory, TerCategory]
  >
>;
export interface DtpValue {
  sectors: readonly DtpSector[];
  permanentMaxMonthlyGross: bigint;
  nonPermanentMaxDailyWage: bigint;
  nonPermanentMaxMonthlyGross: bigint | null;
  requiresValidatedNik: boolean;
}
export interface FinalRateValue {
  rateBps: number | null;
  minPrincipal: bigint | null;
}
export interface DividendValue {
  notReinvestedBps: number;
  reinvestedBps: number;
  reinvestYears: number;
}
export interface IdxShareValue {
  rateBps: number;
  founderSurchargeBps: number;
}
export interface UmkmValue {
  rateBps: number;
  individualExemption: bigint;
  turnoverCeiling: bigint;
  individualTimeLimitYears: number | null;
}
export interface PpnValue {
  nominalBps: number;
  nonLuxuryDpp: Fraction;
  luxuryDpp: Fraction;
}
export interface SptDeadlineValue {
  month: number;
  day: number;
}
export interface SptGraceValue {
  penaltyWaivedUntil: string | null;
}

export interface TaxRuleValueMap {
  "pph.pasal17": readonly Pasal17Band[];
  "pph.ptkp": PtkpValue;
  "pph.biayaJabatan": BiayaJabatanValue;
  "pph.pkpRounding": PkpRoundingValue;
  "pph.zakat": ZakatValue;
  "pph.nppn": NppnValue;
  "pph21.terTables": TerTablesValue;
  "pph21.terCategoryMap": TerCategoryMapValue;
  "pph21.dtp": DtpValue;
  "final.depositoInterest": FinalRateValue;
  "final.savingsInterest": FinalRateValue;
  "final.dividend": DividendValue;
  "final.idxShareSale": IdxShareValue;
  "final.sbnCoupon": FinalRateValue;
  "final.mutualFund": FinalRateValue;
  "final.p2p": FinalRateValue;
  "final.cryptoDomestic": FinalRateValue;
  "final.cryptoForeign": FinalRateValue;
  "final.gold": FinalRateValue;
  "final.rental": FinalRateValue;
  "umkm.final": UmkmValue;
  "ppn.rate": PpnValue;
  "filing.sptDeadline": SptDeadlineValue;
  "filing.sptGrace": SptGraceValue;
}
export type TaxRuleKey = keyof TaxRuleValueMap;

export interface TaxRuleEntry<K extends TaxRuleKey = TaxRuleKey> {
  key: K;
  value: TaxRuleValueMap[K];
  /** Inclusive WIB calendar dates, "YYYY-MM-DD"; effectiveTo null = still in force. */
  effectiveFrom: string;
  effectiveTo: string | null;
  legalBasis: string;
  source: string | null;
  verified: boolean;
  note?: string;
}

export interface TaxRuleRef {
  key: TaxRuleKey;
  legalBasis: string;
  source: string | null;
  verified: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  outOfRange: boolean;
  note: string | null;
}

export type AnyTaxRuleEntry = {
  [K in TaxRuleKey]: TaxRuleEntry<K>;
}[TaxRuleKey];
