import { Prisma } from "@prisma/client";

import { computeUnitValue } from "../value/insurance-value.core";

import {
  FUND_REPORT_KEYS,
  type InsuranceReportKey,
  type InsuranceReportRawField,
  type ReportPageText,
} from "./insurance-report-reader.port";

import type {
  InsuranceReportConflict,
  InsuranceReportFieldDto,
  InsuranceReportMissingDto,
  InsuranceReportValuationDraftDto,
} from "@wealthme/contracts";

/**
 * Asuransi S8 — everything after the model is DETERMINISTIC and lives here:
 * number/date/enum parsing, proving each value against the page text,
 * contradiction detection, units × NAV in Decimal, and the "Data belum
 * lengkap" list. The model's output is only ever strings; nothing here
 * trusts it beyond what can be checked against the source text.
 */

const D = Prisma.Decimal;
type Dec = Prisma.Decimal;

type ParseKind =
  | "money"
  | "units"
  | "nav"
  | "date"
  | "currency"
  | "period"
  | "policyType"
  | "text";

const KIND: Record<InsuranceReportKey, ParseKind> = {
  policyNumber: "text",
  productName: "text",
  provider: "text",
  policyType: "policyType",
  holderName: "text",
  insuredName: "text",
  currency: "currency",
  premiumAmount: "money",
  premiumPeriod: "period",
  sumAssured: "money",
  coverageStartDate: "date",
  coverageEndDate: "date",
  nextPremiumDueDate: "date",
  reportDate: "date",
  policyValue: "money",
  cashValue: "money",
  surrenderValue: "money",
  maturityBenefit: "money",
  fundCurrency: "currency",
  fundUnits: "units",
  fundNav: "nav",
  fundNavDate: "date",
  fundUnitsDate: "date",
  fundValue: "money",
};

/** Max decimals the DB columns hold (Decimal(24,4) money, (24,8) units/NAV). */
const MAX_DP: Record<"money" | "units" | "nav", number> = {
  money: 4,
  units: 8,
  nav: 8,
};
const MAX_INT_DIGITS: Record<"money" | "units" | "nav", number> = {
  money: 20,
  units: 16,
  nav: 16,
};

interface Parsed {
  normalized: string | null;
  ambiguous?: boolean;
}

/**
 * Parses a printed number into a plain decimal string. Indonesian documents
 * use "." for thousands and "," for decimals; English ones the reverse. When
 * both appear, the LAST one is the decimal separator. A single separator
 * followed by exactly three digits ("1.234") is read as thousands, and is
 * flagged ambiguous for units/NAV where three decimals are plausible.
 */
export function parseReportNumber(
  raw: string,
  kind: "money" | "units" | "nav",
): Parsed {
  // "Rp 12.500.000,-" — the Indonesian "no cents" suffix is not a sign.
  let s = raw.trim().replace(/[.,]-$/, "");
  if (/^\(.*\)$/.test(s) || /-/.test(s.replace(/^[A-Za-z$.\s]+/, ""))) {
    return { normalized: null }; // a negative value is not a policy value
  }
  s = s.replace(/[A-Za-z$€£¥\s]/g, "").replace(/^[.,]+|[.,]+$/g, "");
  if (!/^\d[\d.,]*$/.test(s)) return { normalized: null };

  const dots = (s.match(/\./g) ?? []).length;
  const commas = (s.match(/,/g) ?? []).length;
  let intPart: string;
  let fracPart = "";
  let ambiguous = false;

  if (dots > 0 && commas > 0) {
    const decimalSep = s.lastIndexOf(".") > s.lastIndexOf(",") ? "." : ",";
    const thousandSep = decimalSep === "." ? "," : ".";
    const [i = "", f = "", ...rest] = s.split(decimalSep);
    if (rest.length > 0 || !validGroups(i, thousandSep)) {
      return { normalized: null };
    }
    intPart = i.split(thousandSep).join("");
    fracPart = f;
  } else if (dots + commas === 0) {
    intPart = s;
  } else {
    const sep = dots > 0 ? "." : ",";
    const parts = s.split(sep);
    const [head = "", tail = ""] = parts;
    if (parts.length > 2) {
      if (!validGroups(s, sep)) return { normalized: null };
      intPart = parts.join("");
    } else if (tail.length === 3) {
      intPart = parts.join("");
      ambiguous = kind !== "money";
    } else {
      intPart = head;
      fracPart = tail;
    }
  }

  intPart = intPart.replace(/^0+(?=\d)/, "");
  fracPart = fracPart.replace(/0+$/, "");
  if (intPart.length > MAX_INT_DIGITS[kind] || fracPart.length > MAX_DP[kind]) {
    return { normalized: null };
  }
  return {
    normalized: fracPart ? `${intPart}.${fracPart}` : intPart,
    ambiguous,
  };
}

function validGroups(intWithSeps: string, sep: string): boolean {
  const groups = intWithSeps.split(sep);
  const first = groups[0] ?? "";
  return (
    first.length >= 1 &&
    first.length <= 3 &&
    groups.slice(1).every((g) => /^\d{3}$/.test(g))
  );
}

const MONTHS: Record<string, number> = {
  jan: 1,
  januari: 1,
  january: 1,
  feb: 2,
  februari: 2,
  february: 2,
  peb: 2,
  pebruari: 2,
  mar: 3,
  maret: 3,
  march: 3,
  apr: 4,
  april: 4,
  mei: 5,
  may: 5,
  jun: 6,
  juni: 6,
  june: 6,
  jul: 7,
  juli: 7,
  july: 7,
  agu: 8,
  agt: 8,
  ags: 8,
  agustus: 8,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  okt: 10,
  oktober: 10,
  oct: 10,
  october: 10,
  nov: 11,
  nop: 11,
  november: 11,
  nopember: 11,
  des: 12,
  desember: 12,
  dec: 12,
  december: 12,
};

/** Printed date → ISO YYYY-MM-DD. Day-first (Indonesian) for numeric forms. */
export function parseReportDate(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  let y: number, m: number, d: number;
  const n = (v: string | undefined) => Number(v ?? NaN);
  let match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    [y, m, d] = [n(match[1]), n(match[2]), n(match[3])];
  } else if ((match = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) {
    [d, m, y] = [n(match[1]), n(match[2]), n(match[3])];
  } else if (
    (match = s.match(/^(\d{1,2})[\s-]+([a-z]+)\.?[\s-]+(\d{4})$/)) &&
    MONTHS[match[2] ?? ""]
  ) {
    [d, m, y] = [n(match[1]), MONTHS[match[2] ?? ""] ?? NaN, n(match[3])];
  } else {
    return null;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    y < 1900 ||
    y > 2200 ||
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

const CURRENCY_ALIASES: Record<string, string> = {
  RP: "IDR",
  "RP.": "IDR",
  RUPIAH: "IDR",
  $: "USD",
  US$: "USD",
  USD$: "USD",
  S$: "SGD",
};

export function parseReportCurrency(raw: string): string | null {
  const s = raw.trim().toUpperCase();
  if (CURRENCY_ALIASES[s]) return CURRENCY_ALIASES[s];
  return /^[A-Z]{3}$/.test(s) ? s : null;
}

export function parseReportPeriod(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (/sekaligus|tunggal|single|lump/.test(s)) return "single";
  if (/semester|semi|6\s*bulan|enam bulan/.test(s)) return "semiannual";
  if (/triwulan|kuartal|quarter|3\s*bulan|tiga bulan/.test(s))
    return "quarterly";
  if (/tahun|annual|year/.test(s)) return "yearly";
  if (/bulan|month/.test(s)) return "monthly";
  return null;
}

/** Only what the document itself says; never inferred from a product name. */
export function parseReportPolicyType(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (/unit[\s-]?link|paydi|investment[\s-]?linked/.test(s)) return "unit_link";
  if (/tradisional|traditional/.test(s)) return "traditional";
  return null;
}

function parseByKind(raw: string, kind: ParseKind): Parsed {
  switch (kind) {
    case "money":
    case "units":
    case "nav":
      return parseReportNumber(raw, kind);
    case "date":
      return { normalized: parseReportDate(raw) };
    case "currency":
      return { normalized: parseReportCurrency(raw) };
    case "period":
      return { normalized: parseReportPeriod(raw) };
    case "policyType":
      return { normalized: parseReportPolicyType(raw) };
    case "text": {
      const t = raw.replace(/\s+/g, " ").trim();
      return { normalized: t || null };
    }
  }
}

/** Whitespace/column-separator-insensitive, case-insensitive comparison form. */
function squash(text: string): string {
  return text
    .replace(/\s*\|\s*/g, " ")
    .replace(/\s+/g, "")
    .toLowerCase();
}

const FUND_KEYS: ReadonlySet<InsuranceReportKey> = new Set(FUND_REPORT_KEYS);

export function fundLabel(fund: string | null | undefined): string | null {
  const t = fund?.replace(/\s+/g, " ").trim();
  return t ? t : null;
}

const fundKeyOf = (fund: string | null) => fund?.toLowerCase() ?? "";

/**
 * Turns the model's raw items into verified preview fields. Status is
 * `ai_extracted` only when the snippet is found on the stated page, the
 * value appears inside it, the value parses, and no contradicting value was
 * printed; otherwise `needs_confirmation` with the reason.
 */
export function verifyFields(
  raw: InsuranceReportRawField[],
  pages: ReportPageText[],
  policyType: string | null,
): InsuranceReportFieldDto[] {
  const pageText = new Map(pages.map((p) => [p.page, squash(p.text)]));
  const fields = raw
    .filter((f) => !FUND_KEYS.has(f.key) || fundLabel(f.fund))
    .map((f): InsuranceReportFieldDto => {
      const kind = KIND[f.key];
      const parsed = parseByKind(f.value, kind);
      const fund = FUND_KEYS.has(f.key) ? fundLabel(f.fund) : null;
      const source = pageText.get(f.page);
      const snippet = squash(f.snippet);
      const inSource =
        !!source &&
        source.includes(snippet) &&
        snippet.includes(squash(f.value));
      let conflict: InsuranceReportConflict | null = null;
      if (!inSource) conflict = "not_in_source";
      else if (parsed.normalized === null) conflict = "unparseable";
      else if (parsed.ambiguous) conflict = "ambiguous_number";
      else if (f.unclear) conflict = "unclear";
      else if (fund && policyType === "traditional") {
        conflict = "policy_type_mismatch";
      }
      return {
        key: f.key,
        fund,
        value: f.value,
        normalized: parsed.normalized,
        page: f.page,
        snippet: f.snippet,
        status: conflict ? "needs_confirmation" : "ai_extracted",
        conflict,
      };
    });

  // Contradictions: the same key (and fund) printed with different values.
  const groups = new Map<string, InsuranceReportFieldDto[]>();
  for (const f of fields) {
    const k = `${f.key}|${fundKeyOf(f.fund)}`;
    groups.set(k, [...(groups.get(k) ?? []), f]);
  }
  for (const group of groups.values()) {
    const distinct = new Set(
      group.map((f) => (f.normalized ?? f.value).toLowerCase()),
    );
    if (distinct.size > 1) {
      for (const f of group) {
        f.status = "needs_confirmation";
        f.conflict = f.conflict ?? "multiple_values";
      }
    }
  }
  return fields;
}

/** The first (best-verified) field for a key/fund. */
function pick(
  fields: InsuranceReportFieldDto[],
  key: InsuranceReportKey,
  fund: string | null = null,
): InsuranceReportFieldDto | undefined {
  const matches = fields.filter(
    (f) =>
      f.key === key && fundKeyOf(f.fund) === fundKeyOf(fund) && f.normalized,
  );
  return matches.find((f) => f.status === "ai_extracted") ?? matches[0];
}

const MISMATCH_TOLERANCE = new D("0.0001");

/**
 * Assembles value-statement drafts (units × NAV in Decimal) and the
 * "Data belum lengkap" list. Fields flagged `not_in_source` are excluded.
 * - Per fund: units + NAV when both are printed (fundValue only
 *   cross-checks it — never both stored); else fundValue as reportedValue.
 * - Policy level: policyValue / cashValue / surrender / maturity, only when
 *   no fund drafts exist for the value itself (fund rows and the policy
 *   total are two views of the same money).
 */
export function buildDrafts(
  fields: InsuranceReportFieldDto[],
  ctx: {
    policyCurrency: string | null;
    funds: {
      id: string;
      name: string;
      code: string | null;
      currency: string;
    }[];
  },
): {
  valuations: InsuranceReportValuationDraftDto[];
  missing: InsuranceReportMissingDto[];
} {
  // A value the server could not find on its page is shown (flagged) in
  // the field list but never pre-fills a draft: it may be invented.
  fields = fields.filter((f) => f.conflict !== "not_in_source");
  const missing: InsuranceReportMissingDto[] = [];
  const valuations: InsuranceReportValuationDraftDto[] = [];
  const reportDate = pick(fields, "reportDate");
  const policyCurrency =
    pick(fields, "currency")?.normalized ?? ctx.policyCurrency;

  const fundNames = new Map<string, string>();
  for (const f of fields) {
    if (f.fund)
      fundNames.set(
        fundKeyOf(f.fund),
        fundNames.get(fundKeyOf(f.fund)) ?? f.fund,
      );
  }

  for (const fund of fundNames.values()) {
    const units = pick(fields, "fundUnits", fund);
    const nav = pick(fields, "fundNav", fund);
    const navDate = pick(fields, "fundNavDate", fund);
    const unitsDate = pick(fields, "fundUnitsDate", fund);
    const value = pick(fields, "fundValue", fund);
    const matched = ctx.funds.find(
      (x) =>
        x.name.trim().toLowerCase() === fund.toLowerCase() ||
        (x.code && x.code.trim().toLowerCase() === fund.toLowerCase()),
    );
    const currency =
      pick(fields, "fundCurrency", fund)?.normalized ??
      matched?.currency ??
      policyCurrency ??
      null;
    const used = [units, nav, navDate, unitsDate, value].filter(
      (f): f is InsuranceReportFieldDto => !!f,
    );

    const hasUnitPair = !!units && !!nav;
    if (!!units !== !!nav) {
      missing.push({ key: units ? "fundNav" : "fundUnits", fund });
    }
    if (!hasUnitPair && !value) {
      missing.push({ key: "fundValue", fund });
    }
    const effective =
      navDate?.normalized ??
      unitsDate?.normalized ??
      reportDate?.normalized ??
      null;
    if (!effective) missing.push({ key: "fundNavDate", fund });
    if (!currency) missing.push({ key: "fundCurrency", fund });

    let computedValue: string | null = null;
    let warning: InsuranceReportValuationDraftDto["warning"] = null;
    if (hasUnitPair) {
      const r = computeUnitValue({
        units: new D(units.normalized!),
        navPerUnit: new D(nav.normalized!),
        navDate: navDate ? new Date(navDate.normalized!) : null,
        unitsDate: unitsDate ? new Date(unitsDate.normalized!) : null,
      });
      computedValue = r.computedValue?.toFixed() ?? null;
      warning = r.warning;
      if (r.computedValue && value?.normalized) {
        const printed = new D(value.normalized);
        if (!withinTolerance(r.computedValue, printed)) {
          warning = "value_mismatch";
          value.status = "needs_confirmation";
          value.conflict = value.conflict ?? "value_mismatch";
        }
      }
    }
    const primary = hasUnitPair ? units : value;
    valuations.push({
      fund,
      fundId: matched?.id ?? null,
      currency,
      units: hasUnitPair ? units.normalized : null,
      navPerUnit: hasUnitPair ? nav.normalized : null,
      navDate: navDate?.normalized ?? null,
      unitsDate: unitsDate?.normalized ?? null,
      reportedValue: hasUnitPair ? null : (value?.normalized ?? null),
      cashValue: null,
      surrenderEstimate: null,
      maturityBenefit: null,
      effectiveDate: effective,
      page: primary?.page ?? null,
      snippet: primary?.snippet ?? null,
      computedValue,
      warning,
      status:
        used.some((f) => f.status === "needs_confirmation") || warning
          ? "needs_confirmation"
          : "ai_extracted",
    });
  }

  const policyValue = pick(fields, "policyValue");
  const cash = pick(fields, "cashValue");
  const surrender = pick(fields, "surrenderValue");
  const maturity = pick(fields, "maturityBenefit");
  const hasFunds = valuations.length > 0;
  // With fund rows present, a policy-level total or cash value would be a
  // second view of the same money: neither pre-fills a draft then.
  const reported = hasFunds ? undefined : policyValue;
  const cashUsed = hasFunds ? undefined : cash;
  const policyUsed = [reported, cashUsed, surrender, maturity].filter(
    (f): f is InsuranceReportFieldDto => !!f,
  );
  if (policyUsed.length > 0) {
    if (!reportDate) missing.push({ key: "reportDate", fund: null });
    const primary = policyUsed[0];
    valuations.push({
      fund: null,
      fundId: null,
      currency: policyCurrency ?? null,
      units: null,
      navPerUnit: null,
      navDate: null,
      unitsDate: null,
      reportedValue: reported?.normalized ?? null,
      cashValue: cashUsed?.normalized ?? null,
      surrenderEstimate: surrender?.normalized ?? null,
      maturityBenefit: maturity?.normalized ?? null,
      effectiveDate: reportDate?.normalized ?? null,
      page: primary?.page ?? null,
      snippet: primary?.snippet ?? null,
      computedValue: null,
      warning: null,
      status: policyUsed.some((f) => f.status === "needs_confirmation")
        ? "needs_confirmation"
        : "ai_extracted",
    });
    if (!policyCurrency) missing.push({ key: "currency", fund: null });
  }
  if (!hasFunds && !reported && !cash) {
    missing.push({ key: "policyValue", fund: null });
  }
  return { valuations, missing };
}

function withinTolerance(computed: Dec, printed: Dec): boolean {
  const diff = computed.minus(printed).abs();
  const allowed = D.max(new D(1), printed.abs().times(MISMATCH_TOLERANCE));
  return diff.lessThanOrEqualTo(allowed);
}
