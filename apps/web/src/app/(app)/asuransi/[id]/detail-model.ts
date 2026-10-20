import type {
  InsuranceDto,
  InsuranceFundDto,
  InsuranceValuationDto,
  PremiumPeriod,
} from "@wealthme/contracts";

export type DetailTab =
  | "ringkasan"
  | "manfaat"
  | "premi"
  | "investasi"
  | "penerima"
  | "dokumen";
export const DETAIL_TABS: DetailTab[] = [
  "ringkasan",
  "manfaat",
  "premi",
  "investasi",
  "penerima",
  "dokumen",
];

const MONTHS: Partial<Record<PremiumPeriod, number>> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
};

function addMonthsClamped(
  ymd: string,
  months: number,
  anchorDay: number,
): string {
  const [y, m] = ymd.split("-").map(Number) as [number, number];
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = total % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(anchorDay, last);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Upcoming dues after the next one — a PROJECTION from the schedule (the API
 * owns the real schedule; this only lists what the period implies), stopped
 * at the premium payment end. Empty for single/custom.
 */
export function projectedDues(p: InsuranceDto, count: number): string[] {
  const next = p.nextPremiumDueDate?.slice(0, 10);
  const step = MONTHS[p.premiumPeriod];
  if (!next || !step) return [];
  const anchor =
    Number((p.coverageStartDate ?? next).slice(8, 10)) ||
    Number(next.slice(8, 10));
  const end = p.premiumPaymentEndDate?.slice(0, 10) ?? null;
  const out: string[] = [];
  for (let i = 1; out.length < count && i <= count; i++) {
    const d = addMonthsClamped(next, step * i, anchor);
    if (end && d > end) break;
    out.push(d);
  }
  return out;
}

/** The value a statement represents (never both reported and units × NAV). */
export function statementValue(v: InsuranceValuationDto): string | null {
  return v.reportedValue ?? v.computedValue ?? v.cashValue ?? null;
}

export function sortStatements(
  rows: InsuranceValuationDto[],
): InsuranceValuationDto[] {
  return [...rows].sort((a, b) =>
    a.effectiveDate === b.effectiveDate
      ? b.createdAt.localeCompare(a.createdAt)
      : b.effectiveDate.localeCompare(a.effectiveDate),
  );
}

export type FundView = {
  fund: InsuranceFundDto | null;
  latest: InsuranceValuationDto | null;
  latestConfirmed: InsuranceValuationDto | null;
};

/** Latest statement per fund (and policy level), newest effective date first. */
export function fundViews(
  p: InsuranceDto,
  valuations: InsuranceValuationDto[],
): FundView[] {
  const sorted = sortStatements(valuations);
  const pick = (fundId: string | null): FundView => {
    const rows = sorted.filter(
      (v) => v.fundId === fundId && statementValue(v) !== null,
    );
    return {
      fund: (p.funds ?? []).find((f) => f.id === fundId) ?? null,
      latest: rows[0] ?? null,
      latestConfirmed: rows.find((v) => v.status === "confirmed") ?? null,
    };
  };
  const views = (p.funds ?? []).map((f) => pick(f.id));
  const policyLevel = pick(null);
  return policyLevel.latest ? [...views, policyLevel] : views;
}

/** Sum of decimal strings per currency, exact (BigInt with 8 decimals). */
export function sumDecimals(values: string[]): string {
  const SCALE = 8;
  let total = BigInt(0);
  for (const v of values) {
    const [i, f = ""] = v.split(".");
    total += BigInt(`${i}${f.padEnd(SCALE, "0").slice(0, SCALE)}`);
  }
  const s = total.toString().padStart(SCALE + 1, "0");
  const int = s.slice(0, s.length - SCALE);
  const frac = s.slice(s.length - SCALE).replace(/0+$/, "");
  return frac ? `${int}.${frac}` : int;
}
