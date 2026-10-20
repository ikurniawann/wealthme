import { z } from "zod";

/**
 * Asuransi S8 — the ONE schema every insurance-report adapter validates the
 * model's answer against.
 *
 * Same load-bearing rule as `statementReadingSchema`: **the model never
 * produces a final number.** Every value is the text exactly as printed
 * (`z.string()`, never a number), with the page it came from and a short
 * verbatim snippet around it. Units, NAV, money and dates are parsed and
 * multiplied by deterministic server code (`insurance-report-normalize.ts`)
 * with Decimal. There is deliberately no confidence field: the server
 * decides `ai_extracted` vs `needs_confirmation` from checks it can prove
 * (snippet found on the page, value inside the snippet, value parses, no
 * contradicting value) — never from the model's opinion of itself.
 */
export const POLICY_REPORT_KEYS = [
  "policyNumber",
  "productName",
  "provider",
  "policyType",
  "holderName",
  "insuredName",
  "currency",
  "premiumAmount",
  "premiumPeriod",
  "sumAssured",
  "coverageStartDate",
  "coverageEndDate",
  "nextPremiumDueDate",
  "reportDate",
  "policyValue",
  "cashValue",
  "surrenderValue",
  "maturityBenefit",
] as const;

/** Per sub-fund keys: the item MUST name its fund. */
export const FUND_REPORT_KEYS = [
  "fundCurrency",
  "fundUnits",
  "fundNav",
  "fundNavDate",
  "fundUnitsDate",
  "fundValue",
] as const;

export const INSURANCE_REPORT_KEYS = [
  ...POLICY_REPORT_KEYS,
  ...FUND_REPORT_KEYS,
] as const;

export type InsuranceReportKey = (typeof INSURANCE_REPORT_KEYS)[number];

/** Bounds a runaway generation; a real report has far fewer fields. */
export const MAX_REPORT_FIELDS = 300;

const rawFieldSchema = z.object({
  key: z.enum(INSURANCE_REPORT_KEYS),
  /** The value EXACTLY as printed — separators, currency label and all. */
  value: z.string().min(1).max(200),
  /** 1-based page number as given in the page markers. */
  page: z.number().int().min(1).max(1000),
  /** A short verbatim excerpt of the page containing the value. */
  snippet: z.string().min(1).max(300),
  /** Sub-fund name/code as printed; required for fund keys, null otherwise. */
  fund: z.string().max(120).nullable().optional(),
  /** The model marks text it found illegible/ambiguous. Not a score. */
  unclear: z.boolean().optional(),
});

export const insuranceReportReadingSchema = z.object({
  fields: z.array(rawFieldSchema).max(MAX_REPORT_FIELDS),
});

export type InsuranceReportReading = z.infer<
  typeof insuranceReportReadingSchema
>;
export type InsuranceReportRawField = z.infer<typeof rawFieldSchema>;

export interface ReportPageText {
  /** 1-based page number in the source PDF. */
  page: number;
  text: string;
}

export interface InsuranceReportReaderPort {
  readReport(pages: ReportPageText[]): Promise<InsuranceReportReading>;
}
