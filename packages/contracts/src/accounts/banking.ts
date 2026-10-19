import { z } from "zod";

import type { FxCurrencyCode } from "../fx/currencies.js";

/**
 * Rekening v3 — banking vocabulary shared by the API (validation, deposit
 * maturity reminders) and the web (form, page figures). Mirrors the Prisma
 * enums in apps/api/prisma/schema.prisma.
 */

export const BankInstitutionKindSchema = z.enum([
  "commercial",
  "digital",
  "sharia",
  "rural",
  "foreign_branch",
  "foreign",
]);
export type BankInstitutionKind = z.infer<typeof BankInstitutionKindSchema>;

export const BankProductKindSchema = z.enum([
  "savings",
  "current",
  "time_deposit",
  "planned_savings",
  "multi_currency",
]);
export type BankProductKind = z.infer<typeof BankProductKindSchema>;

export const AccountOwnershipFormSchema = z.enum(["individual", "joint", "qq"]);
export type AccountOwnershipForm = z.infer<typeof AccountOwnershipFormSchema>;

export const AccountStatusSchema = z.enum([
  "active",
  "dormant",
  "blocked",
  "closed",
]);
export type AccountStatus = z.infer<typeof AccountStatusSchema>;

export const ShariaContractSchema = z.enum(["wadiah", "mudharabah"]);
export type ShariaContract = z.infer<typeof ShariaContractSchema>;

export const DepositInterestPayoutSchema = z.enum(["at_maturity", "monthly"]);
export type DepositInterestPayout = z.infer<typeof DepositInterestPayoutSchema>;

export const DepositMaturityInstructionSchema = z.enum([
  "aro",
  "aro_plus",
  "non_aro",
]);
export type DepositMaturityInstruction = z.infer<
  typeof DepositMaturityInstructionSchema
>;

export const RoutingCodeKindSchema = z.enum([
  "bank_code",
  "iban",
  "aba",
  "bsb",
]);
export type RoutingCodeKind = z.infer<typeof RoutingCodeKindSchema>;

/**
 * Countries a bank account can be recorded in. Limited to countries whose
 * currency the FX layer can convert, because every balance is stored in IDR
 * and shown back in the account's own currency at today's rate.
 */
export interface BankCountry {
  code: string;
  currency: FxCurrencyCode;
  routingKind: RoutingCodeKind;
  /** Deposit insurance scheme, cap per depositor per bank in `currency`. */
  insurer: string;
  insuranceCap: number;
}

export const INDONESIA: BankCountry = {
  code: "ID",
  currency: "IDR",
  routingKind: "bank_code",
  insurer: "LPS",
  insuranceCap: 2_000_000_000,
};

export const BANK_COUNTRIES: readonly BankCountry[] = [
  INDONESIA,
  {
    code: "SG",
    currency: "SGD",
    routingKind: "bank_code",
    insurer: "SDIC",
    insuranceCap: 100_000,
  },
  {
    code: "US",
    currency: "USD",
    routingKind: "aba",
    insurer: "FDIC",
    insuranceCap: 250_000,
  },
  {
    code: "AU",
    currency: "AUD",
    routingKind: "bsb",
    insurer: "FCS",
    insuranceCap: 250_000,
  },
  {
    code: "JP",
    currency: "JPY",
    routingKind: "bank_code",
    insurer: "DICJ",
    insuranceCap: 10_000_000,
  },
  {
    code: "CN",
    currency: "CNY",
    routingKind: "bank_code",
    insurer: "DIS",
    insuranceCap: 500_000,
  },
  {
    code: "DE",
    currency: "EUR",
    routingKind: "iban",
    insurer: "EdB",
    insuranceCap: 100_000,
  },
  {
    code: "NL",
    currency: "EUR",
    routingKind: "iban",
    insurer: "DGS",
    insuranceCap: 100_000,
  },
  {
    code: "FR",
    currency: "EUR",
    routingKind: "iban",
    insurer: "FGDR",
    insuranceCap: 100_000,
  },
];

export function bankCountry(code: string | null | undefined): BankCountry {
  return (
    BANK_COUNTRIES.find((c) => c.code === (code ?? "ID").toUpperCase()) ??
    INDONESIA
  );
}

/**
 * PPh final on deposit/savings interest (PP 131/2000, PMK 212/PMK.03/2018):
 * 20%, not withheld when the balance is at most Rp 7.5 million.
 */
export const ID_INTEREST_TAX_RATE = 0.2;
export const ID_INTEREST_TAX_FREE_BALANCE = 7_500_000;

/** ISO yyyy-mm-dd of a Date, read in UTC (dates are stored as @db.Date). */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Adds calendar months, clamping to the target month's last day (31 Jan + 1 → 28/29 Feb). */
export function addMonthsUtc(iso: string, months: number): string {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return isoDate(target);
}

/**
 * The deposit's next maturity on or after `today`. A rolling (ARO/ARO+)
 * deposit renews for another tenor each time it matures; a non-ARO one
 * matures once, so a past date is returned as-is. Null when the terms are
 * incomplete.
 */
export function nextMaturityDate(
  placementDate: string | null | undefined,
  tenorMonths: number | null | undefined,
  instruction: DepositMaturityInstruction | null | undefined,
  today: string,
): string | null {
  if (!placementDate || !tenorMonths || tenorMonths <= 0) return null;
  let periods = 1;
  let maturity = addMonthsUtc(placementDate, tenorMonths);
  if (instruction === "non_aro") return maturity;
  // 600 periods = 50 years of monthly rolls: a hard stop, not a real limit.
  while (maturity < today && periods < 600) {
    periods += 1;
    maturity = addMonthsUtc(placementDate, tenorMonths * periods);
  }
  return maturity;
}

/** Whole days from `fromIso` to `toIso` (negative when `toIso` is earlier). */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(
    (Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) /
      86_400_000,
  );
}

/**
 * Estimated interest after Indonesian final tax for `months` months on
 * `balance` (IDR) at `ratePct` % p.a. Foreign accounts are taxed under
 * their own country's rules, so `taxed: false` returns the gross figure.
 */
export function estimateNetInterest(
  balance: number,
  ratePct: number,
  months: number,
  taxed = true,
): number {
  if (!(balance > 0) || !(ratePct > 0) || !(months > 0)) return 0;
  const gross = (balance * (ratePct / 100) * months) / 12;
  const withheld =
    taxed && balance > ID_INTEREST_TAX_FREE_BALANCE
      ? gross * ID_INTEREST_TAX_RATE
      : 0;
  return Math.round(gross - withheld);
}
