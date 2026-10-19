import type { InvestmentType } from "./investment.dto.js";
import type { InvestmentMarket } from "./markets.js";

/**
 * Investasi Task 8 — the ONE investment valuation shape. The API's
 * InvestmentValuationService produces it for /investasi, the investments
 * list, dashboard net worth, reports and (later) /aset.
 *
 * All money is a decimal string. `…Idr` figures are rupiah; native figures
 * carry their own currency field. Percentages are numbers rounded to 2 dp,
 * null when the cost basis is 0 or unknown (never Infinity, never -100%).
 */

/**
 * How a holding's value was obtained (R8):
 * - market      fresh automated quote (Yahoo, CoinGecko, Antam reference)
 * - manual      fresh user-entered price, family gold price, or deposit
 *               accrual from the user's own terms
 * - stale       a price older than MARKETS[market].staleAfterDays; still
 *               values the holding, with its own date
 * - cost_basis  valued at remaining cost by method (bond without a price,
 *               "lainnya" with valuationMethod fixed_cost, deposit without
 *               rate/start date) — counted, but labelled
 * - unpriced    no usable price: EXCLUDED from market totals, totals are
 *               `incomplete`; net worth keeps it at cost (labelled)
 * - failed      like unpriced, but the automated feed was tried and failed
 * - zero_valid  quantity is 0 (fully sold) — a true zero
 */
export const INVESTMENT_VALUATION_BASES = [
  "market",
  "manual",
  "stale",
  "cost_basis",
  "unpriced",
  "failed",
  "zero_valid",
] as const;
export type InvestmentValuationBasis =
  (typeof INVESTMENT_VALUATION_BASES)[number];

/** Bases whose market value is included in market-value totals. */
export const PRICED_VALUATION_BASES: readonly InvestmentValuationBasis[] = [
  "market",
  "manual",
  "stale",
  "cost_basis",
  "zero_valid",
];

export type InvestmentValuationMethod =
  /** quantity × latest price */
  | "price"
  /** emas × FamilyGroup.goldPricePerGram (owner-entered) */
  | "family_gold_price"
  /** emas × Antam 1 kg bar price / 1000 (reference, emasantam.id) */
  | "antam_reference"
  /** principal + simple accrued interest to today (gross, act/365) */
  | "deposit_accrual"
  /** nominal × clean price % + accrued coupon, or quantity × unit price */
  | "bond_price"
  /** remaining cost basis */
  | "cost_basis"
  | "none";

/** Sources written by an automated feed; everything else is manual. */
export const AUTOMATED_PRICE_SOURCES = [
  "yahoo-finance",
  "coingecko",
  "emasantam",
] as const;

/** Never a valuation basis (dev/demo MockMarketDataAdapter). */
export const SIMULATED_PRICE_SOURCE = "mock";

/** Why a holding has no usable valuation (unpriced / failed / cost_basis). */
export type InvestmentValuationReason =
  | "no_price"
  | "no_feed"
  | "feed_failed"
  | "fx_unavailable"
  | "simulated_price_ignored"
  | "deposit_terms_missing"
  | "bond_no_price"
  | "fixed_cost"
  | "cost_unknown";

export interface InvestmentValuationPriceDto {
  /** Per `unitLabel`, in `currency`. For bonds in % of par when so labelled. */
  value: string;
  currency: string;
  unitLabel: string;
  source: string;
  /** When the price applies (quote time, or the date the user entered). */
  asOf: string;
  /** False = only the date of `asOf` is known. */
  hasTime: boolean;
  delayed: boolean;
  reference: string | null;
  /** Whole days between the price date and today (Asia/Jakarta). */
  ageDays: number;
  stale: boolean;
  /** MARKETS[market].staleAfterDays used for `stale`. */
  staleAfterDays: number | null;
}

/** Valuation FX — today's rate, separate from the execution FX of trades. */
export interface InvestmentValuationFxDto {
  currency: string;
  /** IDR per 1 unit of `currency`. */
  idrPerUnit: string;
  rateDate: string;
  source: string;
  /** Provider down, served older stored/indicative rates. */
  stale: boolean;
}

export interface InvestmentDepositAccrualDto {
  principal: string;
  currency: string;
  ratePct: string;
  /** yyyy-mm-dd */
  startDate: string;
  /** yyyy-mm-dd: today, or maturity when already matured. */
  accruedTo: string;
  days: number;
  dayCount: "act/365";
  /** Gross (before the final tax on deposit interest). */
  accruedInterest: string;
  /** Interest already recorded as paid (ledger `interest` rows). */
  interestPaid: string;
}

export interface InvestmentBondValuationDto {
  convention: "percent_of_par" | "per_unit";
  principal: string | null;
  cleanValue: string;
  /** Null when coupon terms are missing (shown as "—", never 0). */
  accruedCoupon: string | null;
  pricesIncludeAccrued: boolean;
}

export interface InvestmentValuationDto {
  investmentId: string;
  type: InvestmentType;
  /** The market used for rules (holding market, or the type fallback). */
  market: InvestmentMarket;
  /** True when `market` is a fallback because Investment.market is null. */
  marketInferred: boolean;
  holdingCurrency: string;
  quantity: string;
  basis: InvestmentValuationBasis;
  method: InvestmentValuationMethod;
  reason: InvestmentValuationReason | null;
  price: InvestmentValuationPriceDto | null;
  valuationFx: InvestmentValuationFxDto | null;
  /** In `marketValueCurrency` (the price currency). Null when not valued. */
  marketValue: string | null;
  marketValueCurrency: string | null;
  /** Rupiah at the valuation FX. Null when unpriced/failed (never 0). */
  marketValueIdr: string | null;
  /** Present on portfolio responses; converted server-side at displayFx. */
  display?: {
    currency: string;
    marketValue: string | null;
    unrealized: string | null;
  };
  /** Remaining cost basis (weighted average, R1), rupiah. */
  costRemainingIdr: string | null;
  costBasisKnown?: boolean;
  /**
   * Remaining cost in the price currency when every active ledger row is in
   * that currency (else null). Lets the UI split price and FX effects.
   */
  costRemainingNative: string | null;
  /** costRemainingIdr / costRemainingNative — average execution FX. */
  executionFxAvg: string | null;
  unrealizedIdr: string | null;
  unrealizedPct: number | null;
  /** (marketValue − costNative) × valuation FX. */
  priceEffectIdr: string | null;
  /** costNative × valuation FX − costRemainingIdr ("0" for IDR holdings). */
  fxEffectIdr: string | null;
  /** Σ realized P/L of active sells, rupiah; null when nothing was sold. */
  realizedIdr: string | null;
  /** Σ dividend/coupon/interest received (net), rupiah. */
  incomeIdr: string;
  /**
   * What net worth counts: marketValueIdr when valued, else the remaining
   * cost (R8 — labelled via `netWorthUsesCost`). Whole rupiah.
   */
  netWorthIdr: string;
  netWorthUsesCost: boolean;
  /** Automated feed state from the price refresh job. */
  feedStatus: "ok" | "failed" | "no_route" | "simulated" | null;
  deposit: InvestmentDepositAccrualDto | null;
  bond: InvestmentBondValuationDto | null;
}

/** Money figure in rupiah plus the display currency (null when IDR). */
export interface InvestmentMoneyDto {
  idr: string;
  display: string | null;
}

export interface InvestmentPlatformCashDto {
  /** Kas tercatat — Σ visible pocket balances. */
  recorded: InvestmentMoneyDto;
  /** Dana tertahan (R9). */
  held: InvestmentMoneyDto;
  /** Dana tersedia = recorded − held. */
  available: InvestmentMoneyDto;
  pocketCount: number;
  /** Pockets whose balances are hidden from this viewer (not summed). */
  hiddenPocketCount: number;
  heldIncomplete: boolean;
}

export interface InvestmentPortfolioTotalsDto {
  /**
   * R8 — true when any holding is unpriced/failed: `assetValue` excludes it
   * and `unpricedCost` carries its remaining cost separately.
   */
  incomplete: boolean;
  unpricedCount: number;
  failedCount: number;
  staleCount: number;
  costValuedCount: number;
  holdingCount: number;
  /** Nilai aset — market value of valued holdings only. */
  assetValue: InvestmentMoneyDto;
  platformCash: InvestmentPlatformCashDto;
  /** assetValue + platformCash.recorded. */
  total: InvestmentMoneyDto;
  /** Modal aset tersisa — every holding. */
  costRemaining: InvestmentMoneyDto | null;
  costIncomplete?: boolean;
  /** Remaining cost of the valued holdings (the base of `unrealized`). */
  pricedCostRemaining: InvestmentMoneyDto;
  unpricedCost: InvestmentMoneyDto | null;
  unrealized: InvestmentMoneyDto | null;
  /** Null when pricedCostRemaining is 0. */
  unrealizedPct: number | null;
  realized: InvestmentMoneyDto | null;
  income: InvestmentMoneyDto;
  /** What net worth counts for investments (unpriced at cost). */
  netWorthValue: InvestmentMoneyDto;
}

/** GET …/investments/valuation */
export interface InvestmentPortfolioValuationDto {
  /** ISO instant the valuation was computed. */
  asOf: string;
  displayCurrency: string;
  /** Null when displayCurrency is IDR. */
  displayFx: InvestmentValuationFxDto | null;
  holdings: InvestmentValuationDto[];
  totals: InvestmentPortfolioTotalsDto;
}

export interface InvestmentPortfolioValuationQuery {
  displayCurrency?: string;
  ownerUserId?: string;
  platformAccountId?: string;
  type?: InvestmentType;
  market?: InvestmentMarket;
}

// ── Manual price batch (preview / bulk) ─────────────────────────────────────

/** Sources a manual batch may claim; automated/mock sources are refused. */
export const MANUAL_PRICE_SOURCES = [
  "manual",
  "broker_statement",
  "fund_factsheet",
  "bank_statement",
  "exchange_website",
  "other",
] as const;
export type ManualPriceSource = (typeof MANUAL_PRICE_SOURCES)[number];

export interface InvestmentPriceBatchRowInput {
  investmentId: string;
  /** Empty/null = skipped (the previous price stays). Else > 0. */
  price?: string | null;
  /** FX currency code of the price. */
  currency: string;
  /** "per lembar", "per unit", "% nominal" … default from MARKETS. */
  unitLabel?: string | null;
  /** yyyy-mm-dd, not in the future. */
  asOfDate: string;
  /** "HH:MM" when the quote time is known. */
  asOfTime?: string | null;
  /** IANA zone of asOfTime; default Asia/Jakarta. */
  timeZone?: string | null;
  source: ManualPriceSource;
  /** URL, statement number, NAB publication … */
  reference?: string | null;
}

export interface InvestmentPriceBatchInput {
  rows: InvestmentPriceBatchRowInput[];
}

export type InvestmentPriceBatchRowStatus = "updated" | "skipped" | "failed";

export type InvestmentPriceBatchRowCode =
  | "empty_price"
  | "duplicate"
  | "older_than_current"
  | "not_found"
  | "duplicate_row"
  | "invalid_price"
  | "invalid_date"
  | "future_date"
  | "invalid_time_zone"
  | "unsupported_currency"
  | "fx_unavailable"
  | "deposit_not_priced";

export interface InvestmentPriceBatchRowResult {
  index: number;
  investmentId: string;
  status: InvestmentPriceBatchRowStatus;
  /** Machine reason for skipped/failed (null when updated). */
  code: InvestmentPriceBatchRowCode | null;
  /** Indonesian message for the row. */
  message: string | null;
  /** Non-blocking notes ("currency_differs_from_holding"). */
  warnings: string[];
  name: string | null;
  ticker: string | null;
  oldPrice: InvestmentValuationPriceDto | null;
  oldBasis: InvestmentValuationBasis | null;
  oldValueIdr: string | null;
  newPrice: string | null;
  newCurrency: string | null;
  newValueIdr: string | null;
  /**
   * Change in what net worth counts for this holding (new − old netWorthIdr,
   * whole rupiah). An unpriced holding's old figure is its cost (R8).
   */
  impactIdr: string | null;
  /** Set on a saved row (bulk only). */
  priceId: string | null;
}

export interface InvestmentPriceBatchResultDto {
  /** False for preview. */
  saved: boolean;
  rows: InvestmentPriceBatchRowResult[];
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  /** Σ impactIdr of updated rows (whole rupiah). */
  impactIdr: string;
}
