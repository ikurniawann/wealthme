/**
 * Investasi R4/R9 — per-market instrument rules. Mirrors the Prisma enum
 * `InvestmentMarket` (apps/api/prisma/schema.prisma).
 *
 * Quantity is ALWAYS stored in `baseUnit` (lembar / share / unit / gram).
 * `lotSize` only converts for display and entry; a lot never reaches the DB.
 *
 * Sources (checked 2026-10-19, do not widen claims without a new source):
 * - IDX: 1 lot = 100 lembar on the regular and cash markets
 *   (IDX rule II-A, Kep-00071/BEI/11-2013, effective 6 Jan 2014); settlement
 *   T+2 since 26 Nov 2018 (KSEI/IDX). Prices are quoted per lembar.
 * - NASDAQ/NYSE: no round-lot requirement for an investor; settlement T+1
 *   since 28 May 2024 (SEC Rule 15c6-1 amendment). Fractional shares are a
 *   BROKER feature, so the default is off and the platform decides
 *   (INVESTMENT_PLATFORMS[].fractionalUsShares).
 * - CRYPTO: divisible units, recorded as settled on the trade date (T+0).
 * - MUTUAL_FUND_ID: unit penyertaan are fractional; R9 records T+0 and only
 *   holds proceeds when the user enters the date the fund confirms.
 * - BOND_ID, GOLD, DEPOSIT, OTHER: no market-wide settlement default is
 *   coded (null) — settlement is the trade date unless the user enters the
 *   broker/bank confirmation date.
 *
 * Every default is editable on the transaction ("sesuai broker").
 *
 * Price staleness (Task 8, `staleAfterDays`): daily-quoted markets (IDX, US,
 * mutual-fund NAB, gold) are stale after 3 days so a Friday close is still
 * current on Monday; crypto trades every day, so 1 day; manually priced bonds
 * 7 days; "other" 30 days; deposits are never stale (accrued to today).
 */

export const INVESTMENT_MARKET_KEYS = [
  "IDX",
  "NASDAQ",
  "NYSE",
  "CRYPTO",
  "MUTUAL_FUND_ID",
  "BOND_ID",
  "GOLD",
  "DEPOSIT",
  "OTHER",
] as const;
export type InvestmentMarket = (typeof INVESTMENT_MARKET_KEYS)[number];

/** How a quantity is shown to the user. "lot" is a display grouping only. */
export type InvestmentDisplayUnit =
  | "lot"
  | "lembar"
  | "share"
  | "unit"
  | "gram";

/** The unit quantity is stored in. */
export type InvestmentBaseUnit = "lembar" | "share" | "unit" | "gram";

export interface MarketConfig {
  key: InvestmentMarket;
  /** Indonesian label; the web translates through i18n. */
  label: string;
  /** ISO 3166-1 alpha-2, null when not a single country. */
  country: string | null;
  /** Default quote currency for prices on this market. */
  currency: string;
  /** Base units per lot. 1 = no lot grouping. */
  lotSize: number;
  /** Whether a holding on this market may hold a fraction by default. */
  allowFractionDefault: boolean;
  /** Decimal places allowed in the stored base quantity. */
  quantityDecimals: number;
  /**
   * Default settlement offset in days after the trade date. null = no market
   * default (settled on the trade date unless the user enters a date).
   */
  settlementDays: number | null;
  /** Business days (true) or calendar days (false) for settlementDays. */
  settlementBusinessDays: boolean;
  baseUnit: InvestmentBaseUnit;
  displayUnit: InvestmentDisplayUnit;
  /** What one price buys, shown next to every price ("per lembar"). */
  priceUnitLabel: string;
  /**
   * Task 8 — a valuation price older than this many calendar days (price
   * date vs today, Asia/Jakarta) is flagged stale. It still values the
   * holding, with its own date. null = never stale (deposits are accrued to
   * today, not priced).
   */
  staleAfterDays: number | null;
}

export const MARKETS: Record<InvestmentMarket, MarketConfig> = {
  IDX: {
    key: "IDX",
    label: "Bursa Efek Indonesia",
    country: "ID",
    currency: "IDR",
    lotSize: 100,
    allowFractionDefault: false,
    quantityDecimals: 0,
    settlementDays: 2,
    settlementBusinessDays: true,
    baseUnit: "lembar",
    displayUnit: "lot",
    priceUnitLabel: "per lembar",
    staleAfterDays: 3,
  },
  NASDAQ: {
    key: "NASDAQ",
    label: "NASDAQ",
    country: "US",
    currency: "USD",
    lotSize: 1,
    allowFractionDefault: false,
    quantityDecimals: 6,
    settlementDays: 1,
    settlementBusinessDays: true,
    baseUnit: "share",
    displayUnit: "share",
    priceUnitLabel: "per share",
    staleAfterDays: 3,
  },
  NYSE: {
    key: "NYSE",
    label: "NYSE",
    country: "US",
    currency: "USD",
    lotSize: 1,
    allowFractionDefault: false,
    quantityDecimals: 6,
    settlementDays: 1,
    settlementBusinessDays: true,
    baseUnit: "share",
    displayUnit: "share",
    priceUnitLabel: "per share",
    staleAfterDays: 3,
  },
  CRYPTO: {
    key: "CRYPTO",
    label: "Aset kripto",
    country: null,
    currency: "IDR",
    lotSize: 1,
    allowFractionDefault: true,
    quantityDecimals: 8,
    settlementDays: 0,
    settlementBusinessDays: false,
    baseUnit: "unit",
    displayUnit: "unit",
    priceUnitLabel: "per unit",
    staleAfterDays: 1,
  },
  MUTUAL_FUND_ID: {
    key: "MUTUAL_FUND_ID",
    label: "Reksa dana Indonesia",
    country: "ID",
    currency: "IDR",
    lotSize: 1,
    allowFractionDefault: true,
    quantityDecimals: 4,
    settlementDays: 0,
    settlementBusinessDays: true,
    baseUnit: "unit",
    displayUnit: "unit",
    priceUnitLabel: "NAB per unit",
    staleAfterDays: 3,
  },
  BOND_ID: {
    key: "BOND_ID",
    label: "Obligasi Indonesia",
    country: "ID",
    currency: "IDR",
    lotSize: 1,
    allowFractionDefault: false,
    quantityDecimals: 0,
    settlementDays: null,
    settlementBusinessDays: true,
    // Quantity keeps the convention of existing obligasi rows; the price
    // convention (% of par vs per unit, clean/dirty) lives in
    // InvestmentDetails.bond.priceConvention.
    baseUnit: "unit",
    displayUnit: "unit",
    priceUnitLabel: "per unit",
    staleAfterDays: 7,
  },
  GOLD: {
    key: "GOLD",
    label: "Emas",
    country: null,
    currency: "IDR",
    lotSize: 1,
    allowFractionDefault: true,
    quantityDecimals: 4,
    settlementDays: null,
    settlementBusinessDays: false,
    baseUnit: "gram",
    displayUnit: "gram",
    priceUnitLabel: "per gram",
    staleAfterDays: 3,
  },
  DEPOSIT: {
    key: "DEPOSIT",
    label: "Deposito",
    country: null,
    currency: "IDR",
    lotSize: 1,
    allowFractionDefault: false,
    quantityDecimals: 0,
    settlementDays: null,
    settlementBusinessDays: true,
    // Legacy deposito rows store quantity = 1 and costBasisPerUnit = nominal.
    baseUnit: "unit",
    displayUnit: "unit",
    priceUnitLabel: "nominal",
    staleAfterDays: null,
  },
  OTHER: {
    key: "OTHER",
    label: "Lainnya",
    country: null,
    currency: "IDR",
    lotSize: 1,
    allowFractionDefault: true,
    quantityDecimals: 8,
    settlementDays: null,
    settlementBusinessDays: false,
    baseUnit: "unit",
    displayUnit: "unit",
    priceUnitLabel: "per unit",
    staleAfterDays: 30,
  },
};

/**
 * The market a holding is valued and staleness-checked under. Legacy rows
 * may have `market = null` (R5); they fall back by type, never by guessing a
 * US listing (an unclassified saham is treated as IDX only when its currency
 * is IDR, else NASDAQ — both have the same daily staleness rule).
 */
export function effectiveMarketFor(
  type: string,
  market: InvestmentMarket | null | undefined,
  currency: string,
): InvestmentMarket {
  if (market) return market;
  switch (type) {
    case "saham":
      return currency === "IDR" ? "IDX" : "NASDAQ";
    case "kripto":
      return "CRYPTO";
    case "reksa_dana":
      return "MUTUAL_FUND_ID";
    case "obligasi":
      return "BOND_ID";
    case "emas":
      return "GOLD";
    case "deposito":
      return "DEPOSIT";
    default:
      return "OTHER";
  }
}
