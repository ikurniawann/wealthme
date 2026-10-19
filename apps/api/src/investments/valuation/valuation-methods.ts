import { Prisma } from "@prisma/client";

import { isValidYmd } from "../ledger/ledger-dates";

import type {
  BondDetails,
  DepositDetails,
  InvestmentBondValuationDto,
  InvestmentDepositAccrualDto,
} from "@wealthme/contracts";

/**
 * Product-specific valuation methods (spec §10: deposits and bonds are not
 * priced like stocks). Pure; Decimal arithmetic only.
 */

const D = Prisma.Decimal;
type Decimal = Prisma.Decimal;
const ZERO = new D(0);
const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_PER_YEAR = 365;

function ymdDays(fromYmd: string, toYmd: string): number {
  const a = Date.parse(`${fromYmd}T00:00:00.000Z`);
  const b = Date.parse(`${toYmd}T00:00:00.000Z`);
  return Math.round((b - a) / DAY_MS);
}

function validYmd(v: string | null | undefined): string | null {
  return v && isValidYmd(v) ? v : null;
}

function positiveDecimal(v: string | null | undefined): Decimal | null {
  if (v === null || v === undefined || v.trim() === "") return null;
  try {
    const d = new D(v);
    return d.greaterThan(0) ? d : null;
  } catch {
    return null;
  }
}

export interface DepositTerms {
  ratePct: Decimal | null;
  /** yyyy-mm-dd */
  startDate: string | null;
  /** yyyy-mm-dd */
  maturityDate: string | null;
}

/** details.deposit wins over the legacy columns (interestRatePct, purchasedAt, maturityDate). */
export function depositTerms(
  details: DepositDetails | undefined,
  legacy: {
    interestRatePct: Decimal | null;
    purchasedYmd: string | null;
    maturityYmd: string | null;
  },
): DepositTerms {
  return {
    ratePct: positiveDecimal(details?.ratePct) ?? legacy.interestRatePct,
    startDate: validYmd(details?.startDate) ?? legacy.purchasedYmd,
    maturityDate: validYmd(details?.maturityDate) ?? legacy.maturityYmd,
  };
}

/**
 * Deposit value = principal + simple accrued interest to today (gross,
 * actual/365), capped at maturity, less interest already recorded as paid
 * (ledger `interest` rows) so cash received is not counted twice. Never
 * below the principal. Null when the rate or start date is unknown.
 */
export function depositAccrual(
  principal: Decimal,
  currency: string,
  terms: DepositTerms,
  todayYmd: string,
  interestPaid: Decimal,
): { value: Decimal; dto: InvestmentDepositAccrualDto } | null {
  if (!terms.ratePct || !terms.startDate) return null;
  const end =
    terms.maturityDate && terms.maturityDate < todayYmd
      ? terms.maturityDate
      : todayYmd;
  const days = Math.max(0, ymdDays(terms.startDate, end));
  const gross = principal
    .times(terms.ratePct)
    .dividedBy(100)
    .times(days)
    .dividedBy(DAYS_PER_YEAR);
  const unpaid = D.max(ZERO, gross.minus(interestPaid));
  return {
    value: principal.plus(unpaid),
    dto: {
      principal: principal.toDecimalPlaces(2).toString(),
      currency,
      ratePct: terms.ratePct.toString(),
      startDate: terms.startDate,
      accruedTo: end,
      days,
      dayCount: "act/365",
      accruedInterest: gross.toDecimalPlaces(2).toString(),
      interestPaid: interestPaid.toDecimalPlaces(2).toString(),
    },
  };
}

/** Months back from maturity to the last coupon date on/before today. */
function lastCouponYmd(
  maturityYmd: string,
  frequency: number,
  todayYmd: string,
): string | null {
  const step = Math.round(12 / frequency);
  if (step <= 0 || 12 % frequency !== 0) return null;
  const [y = 0, mo = 1, day = 1] = maturityYmd.split("-").map(Number);
  // Guard: at most 100 years of coupons.
  for (let i = 0; i < 1200 / step; i++) {
    const monthIndex = y * 12 + (mo - 1) - i * step;
    const year = Math.floor(monthIndex / 12);
    const month = monthIndex - year * 12;
    // Clamp the day (a 31st maturity pays on the 30th/28th in short months).
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const ymd = new Date(Date.UTC(year, month, Math.min(day, lastDay)))
      .toISOString()
      .slice(0, 10);
    if (ymd <= todayYmd) return ymd;
  }
  return null;
}

/**
 * Bond value from a user-supplied price.
 * - percent_of_par with a principal: principal × price / 100, plus accrued
 *   coupon (principal × coupon% × days since the last coupon / 365) when
 *   prices are clean and the coupon terms are known; else accrued is null.
 * - otherwise per unit: quantity × price (no accrued coupon).
 */
export function bondValue(
  details: BondDetails | undefined,
  quantity: Decimal,
  price: Decimal,
  priceUnitLabel: string,
  todayYmd: string,
): { value: Decimal; dto: InvestmentBondValuationDto } {
  const principal = positiveDecimal(details?.principal);
  const percentConvention =
    details?.priceConvention === "percent_of_par" ||
    (details?.priceConvention === undefined && priceUnitLabel.includes("%"));
  const includesAccrued = details?.pricesIncludeAccrued === true;

  if (!percentConvention || !principal) {
    const clean = quantity.times(price);
    return {
      value: clean,
      dto: {
        convention: "per_unit",
        principal: principal?.toString() ?? null,
        cleanValue: clean.toDecimalPlaces(2).toString(),
        accruedCoupon: null,
        pricesIncludeAccrued: includesAccrued,
      },
    };
  }

  const clean = principal.times(price).dividedBy(100);
  let accrued: Decimal | null = includesAccrued ? ZERO : null;
  const couponPct = positiveDecimal(details?.couponRatePct);
  const frequency = details?.couponFrequency;
  const maturity = validYmd(details?.maturityDate);
  if (!includesAccrued && couponPct && frequency && maturity) {
    const accruedTo = todayYmd > maturity ? maturity : todayYmd;
    const last = lastCouponYmd(maturity, frequency, accruedTo);
    if (last) {
      const days = Math.max(0, ymdDays(last, accruedTo));
      accrued = principal
        .times(couponPct)
        .dividedBy(100)
        .times(days)
        .dividedBy(DAYS_PER_YEAR);
    }
  }
  return {
    value: clean.plus(accrued ?? ZERO),
    dto: {
      convention: "percent_of_par",
      principal: principal.toString(),
      cleanValue: clean.toDecimalPlaces(2).toString(),
      accruedCoupon:
        accrued === null ? null : accrued.toDecimalPlaces(2).toString(),
      pricesIncludeAccrued: includesAccrued,
    },
  };
}

/** Units for which the family/Antam per-gram gold prices apply. */
export function isGramUnit(unit: string | undefined): boolean {
  if (!unit) return true;
  const u = unit.trim().toLowerCase();
  return u === "gram" || u === "g" || u === "gr";
}
