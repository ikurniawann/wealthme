import {
  canonicalToTyping,
  formatMoneyTyping,
  toCanonicalAmount,
} from "@/components/money";

import type {
  CreateInsuranceBenefitDto,
  CreateInsuranceInsuredDto,
  InsuranceBenefitKind,
  InsuranceBenefitPeriod,
  InsuranceDto,
  InsuranceFundDto,
  InsurancePolicyType,
  InsuranceStatus,
  InsuranceType,
  InsuranceValuationDto,
  PremiumPeriod,
} from "@wealthme/contracts";

/**
 * Task 25 — state + pure helpers for the sectioned policy drawer.
 *
 * Rollback ruling (Task 21/22): the API still accepts only the legacy
 * statuses and premium periods. The form offers exactly these; widen BOTH
 * constants here (and the API's ACCEPTED_* in next-renewal-date.util.ts)
 * once the rollback window closes.
 */
export const FORM_STATUSES: readonly InsuranceStatus[] = [
  "aktif",
  "tidak_aktif",
  "kadaluarsa",
];
export const FORM_PERIODS: readonly PremiumPeriod[] = [
  "monthly",
  "quarterly",
  "yearly",
];
export const FORM_TYPES: readonly InsuranceType[] = [
  "jiwa",
  "kesehatan",
  "kendaraan",
  "properti",
  "pendidikan",
  "lainnya",
];
export const POLICY_CURRENCIES = [
  "IDR",
  "USD",
  "SGD",
  "EUR",
  "JPY",
  "AUD",
  "CNY",
  "GBP",
  "HKD",
  "MYR",
  "THB",
  "PHP",
  "KRW",
  "INR",
] as const;

/** Units / NAV accept up to 8 decimals (API DEC_8); typed id-ID style. */
export const UNIT_DECIMALS = 4;
export const NAV_DECIMALS = 4;
export const VALUE_DECIMALS = 2;

let rowSeq = 0;
export const newRowId = (prefix: string) => `${prefix}-${++rowSeq}`;

export type PersonRow = {
  rowId: string;
  memberUserId: string;
  name: string;
  relationship: string;
};

export type BenefitRow = {
  rowId: string;
  kind: InsuranceBenefitKind;
  label: string;
  raw: string;
  currency: string;
  period: InsuranceBenefitPeriod | "";
  note: string;
};

/** A sub-fund line: identity + an optional NEW value statement. */
export type FundRow = {
  rowId: string;
  fundId: string | null;
  name: string;
  code: string;
  /** Stored name/code (existing funds) — a change is PATCHed. */
  initialName: string;
  initialCode: string;
  currency: string;
  units: string;
  nav: string;
  navDate: string;
  unitsDate: string;
  /** User ticked "sudah saya periksa" → saved as confirmed. */
  confirmed: boolean;
  /** Provenance when the line came from the AI review. */
  page: number | null;
  snippet: string | null;
  latest: InsuranceValuationDto | null;
};

export type CashValueRow = {
  cashValue: string;
  surrenderEstimate: string;
  maturityBenefit: string;
  guaranteed: boolean;
  effectiveDate: string;
  confirmed: boolean;
};

export type PolicyFormState = {
  name: string;
  provider: string;
  policyNumber: string;
  type: InsuranceType;
  policyType: InsurancePolicyType | "";
  status: InsuranceStatus;
  currency: string;
  holderUserId: string;
  holderName: string;
  insured: PersonRow[];
  payerUserId: string;
  payerName: string;
  coverageStartDate: string;
  coverageEndDate: string;
  policyRenewalDate: string;
  premiumPeriod: PremiumPeriod;
  nextPremiumDueDate: string;
  premiumPaymentEndDate: string;
  autoRenewDate: boolean;
  paymentAccountId: string;
  benefits: BenefitRow[];
  funds: FundRow[];
  cash: CashValueRow;
  includeInNetWorth: boolean;
  notes: string;
};

const d10 = (v: string | null | undefined) => (v ? v.slice(0, 10) : "");

export function decimalToTyping(
  v: string | null | undefined,
  decimals: number,
): string {
  return v ? canonicalToTyping(v, decimals) : "";
}

export function typingDecimals(raw: string, decimals: number): string {
  return formatMoneyTyping(raw, decimals);
}

export const canonical = (raw: string): string | null => toCanonicalAmount(raw);

export function emptyBenefit(
  kind: InsuranceBenefitKind,
  currency: string,
): BenefitRow {
  return {
    rowId: newRowId("benefit"),
    kind,
    label: "",
    raw: "",
    currency,
    period: "",
    note: "",
  };
}

export function emptyFund(currency: string): FundRow {
  return {
    rowId: newRowId("fund"),
    fundId: null,
    name: "",
    code: "",
    initialName: "",
    initialCode: "",
    currency,
    units: "",
    nav: "",
    navDate: "",
    unitsDate: "",
    confirmed: false,
    page: null,
    snippet: null,
    latest: null,
  };
}

export function emptyPerson(): PersonRow {
  return {
    rowId: newRowId("person"),
    memberUserId: "",
    name: "",
    relationship: "",
  };
}

function latestByFund(
  valuations: InsuranceValuationDto[],
  fundId: string | null,
): InsuranceValuationDto | null {
  return (
    valuations
      .filter((v) => v.fundId === fundId)
      .sort((a, b) =>
        b.effectiveDate === a.effectiveDate
          ? b.createdAt.localeCompare(a.createdAt)
          : b.effectiveDate.localeCompare(a.effectiveDate),
      )[0] ?? null
  );
}

export function initialFormState(
  p: InsuranceDto | null,
  valuations: InsuranceValuationDto[] = [],
): PolicyFormState {
  const currency = p?.currency ?? "IDR";
  const benefits: BenefitRow[] = (p?.benefits ?? []).map((b) => ({
    rowId: newRowId("benefit"),
    kind: b.kind,
    label: b.label ?? "",
    raw: decimalToTyping(b.amount, b.currency === "IDR" ? 0 : 2),
    currency: b.currency,
    period: b.period ?? "",
    note: b.note ?? "",
  }));
  return {
    name: p?.name ?? "",
    provider: p?.provider ?? "",
    policyNumber: p?.policyNumber ?? "",
    type: p?.type ?? "jiwa",
    policyType: p?.policyType ?? "",
    status: p && FORM_STATUSES.includes(p.status) ? p.status : "aktif",
    currency,
    holderUserId: p?.holderUserId ?? "",
    holderName: p?.holderUserId ? "" : (p?.holderName ?? ""),
    insured: (p?.insured ?? []).map((i) => ({
      rowId: newRowId("person"),
      memberUserId: i.memberUserId ?? "",
      name: i.name,
      relationship: i.relationship ?? "",
    })),
    payerUserId: p?.payerUserId ?? "",
    payerName: p?.payerUserId ? "" : (p?.payerName ?? ""),
    coverageStartDate: d10(p?.coverageStartDate),
    coverageEndDate: d10(p?.coverageEndDate),
    policyRenewalDate: d10(p?.policyRenewalDate),
    premiumPeriod:
      p && FORM_PERIODS.includes(p.premiumPeriod) ? p.premiumPeriod : "monthly",
    nextPremiumDueDate: d10(p?.nextPremiumDueDate ?? p?.renewalDate),
    premiumPaymentEndDate: d10(p?.premiumPaymentEndDate),
    autoRenewDate: p?.autoRenewDate ?? false,
    paymentAccountId: p?.paymentAccountId ?? "",
    benefits:
      benefits.length > 0
        ? benefits
        : [emptyBenefit("life_sum_assured", "IDR")],
    funds: (p?.funds ?? []).map((f) => fundRowFrom(f, valuations)),
    cash: {
      cashValue: "",
      surrenderEstimate: "",
      maturityBenefit: "",
      guaranteed: false,
      effectiveDate: "",
      confirmed: false,
    },
    includeInNetWorth: p?.includeInNetWorth ?? false,
    notes: p?.notes ?? "",
  };
}

function fundRowFrom(
  f: InsuranceFundDto,
  valuations: InsuranceValuationDto[],
): FundRow {
  return {
    ...emptyFund(f.currency),
    fundId: f.id,
    name: f.name,
    code: f.code ?? "",
    initialName: f.name,
    initialCode: f.code ?? "",
    latest: latestByFund(valuations, f.id),
  };
}

/** True when the fund line carries a new statement to save. */
export function fundHasStatement(f: FundRow): boolean {
  return Boolean(canonical(f.units) || canonical(f.nav));
}

export function cashHasStatement(c: CashValueRow): boolean {
  return Boolean(
    canonical(c.cashValue) ||
    canonical(c.surrenderEstimate) ||
    canonical(c.maturityBenefit),
  );
}

/**
 * Exact decimal product for the live preview (the API recomputes units × NAV
 * with Decimal and is the authority). Returns a plain decimal string.
 */
export function mulDecimal(a: string, b: string): string {
  const split = (s: string) => {
    const [i, f = ""] = s.split(".");
    return { digits: BigInt(`${i}${f}` || "0"), scale: f.length };
  };
  const x = split(a);
  const y = split(b);
  const scale = x.scale + y.scale;
  const raw = (x.digits * y.digits).toString().padStart(scale + 1, "0");
  if (scale === 0) return raw;
  const int = raw.slice(0, raw.length - scale);
  const frac = raw.slice(raw.length - scale).replace(/0+$/, "");
  return frac ? `${int}.${frac}` : int;
}

export type FormIssue = { field: string; message: string };

export type FormIssueCopy = {
  nameRequired: string;
  premiumPositive: string;
  holderRequired: string;
  coverageOrder: string;
  premiumEndOrder: string;
  fundName: string;
  fundPair: string;
  fundDate: string;
  futureDate: string;
  cashDate: string;
  benefitAmount: string;
};

export function validateForm(
  s: PolicyFormState,
  premiumDigits: string,
  today: string,
  copy: FormIssueCopy,
): FormIssue[] {
  const issues: FormIssue[] = [];
  if (!s.name.trim())
    issues.push({ field: "name", message: copy.nameRequired });
  if (!premiumDigits || BigInt(premiumDigits) <= BigInt(0))
    issues.push({ field: "premium", message: copy.premiumPositive });
  if (
    s.coverageStartDate &&
    s.coverageEndDate &&
    s.coverageEndDate < s.coverageStartDate
  )
    issues.push({ field: "coverageEndDate", message: copy.coverageOrder });
  if (
    s.coverageStartDate &&
    s.premiumPaymentEndDate &&
    s.premiumPaymentEndDate < s.coverageStartDate
  )
    issues.push({
      field: "premiumPaymentEndDate",
      message: copy.premiumEndOrder,
    });
  s.benefits.forEach((b) => {
    if (b.raw && canonical(b.raw) === null)
      issues.push({ field: `benefit-${b.rowId}`, message: copy.benefitAmount });
  });
  if (s.policyType === "unit_link") {
    s.funds.forEach((f) => {
      if (!f.name.trim())
        issues.push({ field: `fund-${f.rowId}`, message: copy.fundName });
      if (!fundHasStatement(f)) return;
      if (!canonical(f.units) || !canonical(f.nav))
        issues.push({ field: `fund-${f.rowId}`, message: copy.fundPair });
      else if (!f.navDate)
        issues.push({ field: `fund-${f.rowId}`, message: copy.fundDate });
      else if (f.navDate > today || (f.unitsDate && f.unitsDate > today))
        issues.push({ field: `fund-${f.rowId}`, message: copy.futureDate });
    });
  }
  if (s.policyType === "traditional" && cashHasStatement(s.cash)) {
    if (!s.cash.effectiveDate)
      issues.push({ field: "cash", message: copy.cashDate });
    else if (s.cash.effectiveDate > today)
      issues.push({ field: "cash", message: copy.futureDate });
  }
  return issues;
}

export function toInsuredDtos(rows: PersonRow[]): CreateInsuranceInsuredDto[] {
  return rows
    .filter((r) => r.name.trim() || r.memberUserId)
    .map((r) => ({
      name: r.name.trim(),
      ...(r.relationship.trim() && { relationship: r.relationship.trim() }),
      ...(r.memberUserId && { memberUserId: r.memberUserId }),
    }));
}

export function toBenefitDtos(rows: BenefitRow[]): CreateInsuranceBenefitDto[] {
  const kept = rows.filter(
    (b) => b.raw.trim() || b.label.trim() || b.note.trim(),
  );
  return kept.map((b, i) => {
    const amount = canonical(b.raw);
    return {
      kind: b.kind,
      ...(b.label.trim() && { label: b.label.trim() }),
      ...(amount && { amount }),
      currency: b.currency,
      ...(b.period && { period: b.period }),
      ...(b.note.trim() && { note: b.note.trim() }),
      isPrimary: i === 0,
    };
  });
}
