import { Prisma } from "@prisma/client";
import {
  AUTOMATED_PRICE_SOURCES,
  MARKETS,
  PRICED_VALUATION_BASES,
  effectiveMarketFor,
} from "@wealthme/contracts";

import {
  bondValue,
  depositAccrual,
  depositTerms,
  isGramUnit,
} from "./valuation-methods";

import type { PriceFeedStatus } from "./price-feed-status.registry";
import type {
  InvestmentBondValuationDto,
  InvestmentDepositAccrualDto,
  InvestmentDetails,
  InvestmentMarket,
  InvestmentType,
  InvestmentValuationBasis,
  InvestmentValuationDto,
  InvestmentValuationFxDto,
  InvestmentValuationMethod,
  InvestmentValuationReason,
} from "@wealthme/contracts";

/**
 * Investasi Task 8 — the ONE investment valuation formula (pure, no I/O).
 * InvestmentValuationService loads the inputs; dashboard net worth, reports,
 * the investments list and the /investasi summary all read its output.
 *
 * Book currency is IDR (Task 7): `costBasisPerUnit` is the weighted-average
 * IDR cost. Prices carry their own currency; a foreign price is valued in
 * IDR at TODAY's valuation FX (never the execution FX of the trades).
 */

const D = Prisma.Decimal;
type Decimal = Prisma.Decimal;
const ZERO = new D(0);
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const AUTOMATED: readonly string[] = AUTOMATED_PRICE_SOURCES;

export const FAMILY_GOLD_PRICE_SOURCE = "family-gold-price";
export const ANTAM_GOLD_SOURCE = "emasantam";
export const DEPOSIT_ACCRUAL_SOURCE = "computed-interest";

export interface ValuationPrice {
  price: Decimal;
  currency: string;
  unitLabel: string | null;
  source: string;
  asOf: Date | null;
  recordedAt: Date;
  hasTime: boolean;
  delayed: boolean;
  reference: string | null;
}

/** Valuation FX snapshot: IDR per 1 unit, as decimal strings. */
export interface ValuationFx {
  idrPerUnit: Record<string, string>;
  rateDate: string;
  source: string;
  stale: boolean;
}

/** Facts from the holding's active ledger rows (see ledger-facts.ts). */
export interface LedgerFacts {
  /** Σ realizedPnl of active sells (IDR); null when nothing was sold. */
  realizedIdr: Decimal | null;
  /** Σ net income (dividend/coupon/interest) in IDR. */
  incomeIdr: Decimal;
  /** Remaining cost in one native currency, when every position row shares it. */
  costNative: { currency: string; amount: Decimal } | null;
  /** Σ gross `interest` rows per currency (deposits). */
  interestPaid: Map<string, Decimal>;
}

export interface HoldingValuationInput {
  id: string;
  type: InvestmentType;
  market: InvestmentMarket | null;
  currency: string;
  quantity: Decimal;
  costBasisPerUnit: Decimal;
  interestRatePct: Decimal | null;
  purchasedAt: Date | null;
  maturityDate: Date | null;
  details: InvestmentDetails | null;
  /** Latest non-simulated InvestmentPrice row. */
  latestPrice: ValuationPrice | null;
  familyGold: { perGramIdr: Decimal; updatedAt: Date | null } | null;
  antamGold: { perGramIdr: Decimal; fetchedAt: Date } | null;
  ledger: LedgerFacts | null;
  feed: PriceFeedStatus | null;
}

export interface ValuationContext {
  now: Date;
  fx: ValuationFx | null;
}

interface Candidate {
  method: InvestmentValuationMethod;
  value: Decimal;
  currency: string;
  unitLabel: string;
  source: string;
  asOf: Date;
  hasTime: boolean;
  delayed: boolean;
  reference: string | null;
}

export function jakartaYmd(instant: Date): string {
  return new Date(instant.getTime() + JAKARTA_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

function ageDays(asOf: Date, todayYmd: string): number {
  const a = Date.parse(`${jakartaYmd(asOf)}T00:00:00.000Z`);
  const b = Date.parse(`${todayYmd}T00:00:00.000Z`);
  return Math.max(0, Math.round((b - a) / DAY_MS));
}

function money(d: Decimal): string {
  return d.toDecimalPlaces(2, D.ROUND_HALF_UP).toString();
}

function wholeRupiah(d: Decimal): Decimal {
  return d.toDecimalPlaces(0, D.ROUND_HALF_UP);
}

/** Percentage rounded to 2 dp; null when the base is 0 or unknown. */
export function pct(part: Decimal, base: Decimal | null): number | null {
  if (!base || base.isZero()) return null;
  return part.dividedBy(base).times(100).toDecimalPlaces(2).toNumber();
}

export function idrPerUnit(
  fx: ValuationFx | null,
  currency: string,
): Decimal | null {
  if (currency === "IDR") return new D(1);
  const raw = fx?.idrPerUnit[currency];
  if (!raw) return null;
  const rate = new D(raw);
  return rate.greaterThan(0) ? rate : null;
}

function fxDto(
  fx: ValuationFx | null,
  currency: string,
): InvestmentValuationFxDto | null {
  const rate = idrPerUnit(fx, currency);
  if (currency === "IDR" || !fx || !rate) return null;
  return {
    currency,
    idrPerUnit: rate.toString(),
    rateDate: fx.rateDate,
    source: fx.source,
    stale: fx.stale,
  };
}

function priceCandidate(
  p: ValuationPrice,
  method: InvestmentValuationMethod,
  defaultUnit: string,
): Candidate {
  return {
    method,
    value: p.price,
    currency: p.currency,
    unitLabel: p.unitLabel ?? defaultUnit,
    source: p.source,
    asOf: p.asOf ?? p.recordedAt,
    hasTime: p.hasTime,
    delayed: p.delayed,
    reference: p.reference,
  };
}

/**
 * Gold: the most recent of the holding's own price and the family gold
 * price (owner-entered, per gram) wins; the Antam 1 kg reference (/1000) is
 * used only when neither exists. Per-gram prices apply only to gram units.
 */
function goldCandidate(
  inv: HoldingValuationInput,
  defaultUnit: string,
): Candidate | null {
  const own = inv.latestPrice
    ? priceCandidate(inv.latestPrice, "price", defaultUnit)
    : null;
  if (!isGramUnit(inv.details?.gold?.unit)) return own;
  const family = inv.familyGold
    ? {
        method: "family_gold_price" as const,
        value: inv.familyGold.perGramIdr,
        currency: "IDR",
        unitLabel: "per gram",
        source: FAMILY_GOLD_PRICE_SOURCE,
        asOf: inv.familyGold.updatedAt ?? new Date(0),
        hasTime: inv.familyGold.updatedAt !== null,
        delayed: false,
        reference: null,
      }
    : null;
  if (own && family) return own.asOf >= family.asOf ? own : family;
  if (own ?? family) return own ?? family;
  if (!inv.antamGold) return null;
  return {
    method: "antam_reference",
    value: inv.antamGold.perGramIdr,
    currency: "IDR",
    unitLabel: "per gram (acuan Antam 1 kg)",
    source: ANTAM_GOLD_SOURCE,
    asOf: inv.antamGold.fetchedAt,
    hasTime: true,
    delayed: false,
    reference: "emasantam.id",
  };
}

interface Valued {
  method: InvestmentValuationMethod;
  /** In `currency`. */
  value: Decimal;
  currency: string;
  candidate: Candidate | null;
  deposit: InvestmentDepositAccrualDto | null;
  bond: InvestmentBondValuationDto | null;
  costValued: boolean;
  reason: InvestmentValuationReason | null;
}

function legacyYmd(d: Date | null): string | null {
  return d ? jakartaYmd(d) : null;
}

function valueDeposit(
  inv: HoldingValuationInput,
  costIdr: Decimal,
  todayYmd: string,
): Valued {
  const native = inv.ledger?.costNative;
  const useNative =
    inv.currency !== "IDR" && native && native.currency === inv.currency;
  const principal = useNative ? native.amount : costIdr;
  const currency = useNative ? native.currency : "IDR";
  const terms = depositTerms(inv.details?.deposit, {
    interestRatePct: inv.interestRatePct,
    purchasedYmd: legacyYmd(inv.purchasedAt),
    maturityYmd: legacyYmd(inv.maturityDate),
  });
  const paid = inv.ledger?.interestPaid.get(currency) ?? ZERO;
  const accrual = depositAccrual(principal, currency, terms, todayYmd, paid);
  if (!accrual) {
    return {
      method: "cost_basis",
      value: principal,
      currency,
      candidate: null,
      deposit: null,
      bond: null,
      costValued: true,
      reason: "deposit_terms_missing",
    };
  }
  return {
    method: "deposit_accrual",
    value: accrual.value,
    currency,
    candidate: null,
    deposit: accrual.dto,
    bond: null,
    costValued: false,
    reason: null,
  };
}

function costValued(
  costIdr: Decimal,
  reason: InvestmentValuationReason,
): Valued {
  return {
    method: "cost_basis",
    value: costIdr,
    currency: "IDR",
    candidate: null,
    deposit: null,
    bond: null,
    costValued: true,
    reason,
  };
}

/** Picks the method and its native value; null = no usable valuation. */
function valueByMethod(
  inv: HoldingValuationInput,
  market: InvestmentMarket,
  costIdr: Decimal,
  todayYmd: string,
): Valued | null {
  const defaultUnit = MARKETS[market].priceUnitLabel;
  if (inv.type === "deposito" || market === "DEPOSIT") {
    return valueDeposit(inv, costIdr, todayYmd);
  }
  if (inv.type === "obligasi" || market === "BOND_ID") {
    if (!inv.latestPrice) return costValued(costIdr, "bond_no_price");
    const c = priceCandidate(inv.latestPrice, "bond_price", defaultUnit);
    const b = bondValue(
      inv.details?.bond,
      inv.quantity,
      c.value,
      c.unitLabel,
      todayYmd,
    );
    return {
      method: "bond_price",
      value: b.value,
      currency: c.currency,
      candidate: c,
      deposit: null,
      bond: b.dto,
      costValued: false,
      reason: null,
    };
  }
  if (
    inv.type === "lainnya" &&
    inv.details?.other?.valuationMethod === "fixed_cost"
  ) {
    return costValued(costIdr, "fixed_cost");
  }
  const c =
    inv.type === "emas" || market === "GOLD"
      ? goldCandidate(inv, defaultUnit)
      : inv.latestPrice
        ? priceCandidate(inv.latestPrice, "price", defaultUnit)
        : null;
  if (!c) return null;
  return {
    method: c.method,
    value: inv.quantity.times(c.value),
    currency: c.currency,
    candidate: c,
    deposit: null,
    bond: null,
    costValued: false,
    reason: null,
  };
}

function missingReason(inv: HoldingValuationInput): InvestmentValuationReason {
  switch (inv.feed?.state) {
    case "failed":
      return "feed_failed";
    case "no_route":
      return "no_feed";
    case "simulated":
      return "simulated_price_ignored";
    default:
      return "no_price";
  }
}

function basisFor(v: Valued, stale: boolean): InvestmentValuationBasis {
  if (v.costValued) return "cost_basis";
  if (stale) return "stale";
  if (v.method === "deposit_accrual") return "manual";
  const source = v.candidate?.source ?? "";
  return AUTOMATED.includes(source) ? "market" : "manual";
}

/** The shared valuation of one holding. */
export function valueHolding(
  inv: HoldingValuationInput,
  ctx: ValuationContext,
): InvestmentValuationDto {
  const market = effectiveMarketFor(inv.type, inv.market, inv.currency);
  const staleAfterDays = MARKETS[market].staleAfterDays;
  const todayYmd = jakartaYmd(ctx.now);
  const costIdr = inv.quantity.times(inv.costBasisPerUnit);
  const costKnown = inv.details?.costBasisKnown !== false;
  const ledger = inv.ledger;

  const base = {
    investmentId: inv.id,
    type: inv.type,
    market,
    marketInferred: inv.market === null,
    holdingCurrency: inv.currency,
    quantity: inv.quantity.toString(),
    costRemainingIdr: costKnown ? money(costIdr) : null,
    costBasisKnown: costKnown,
    realizedIdr:
      costKnown && ledger?.realizedIdr ? money(ledger.realizedIdr) : null,
    incomeIdr: money(ledger?.incomeIdr ?? ZERO),
    feedStatus: inv.feed?.state ?? null,
  };

  if (inv.quantity.isZero()) {
    return {
      ...base,
      basis: "zero_valid",
      method: "none",
      reason: null,
      price: null,
      valuationFx: null,
      marketValue: "0",
      marketValueCurrency: inv.currency,
      marketValueIdr: "0",
      costRemainingNative: null,
      executionFxAvg: null,
      unrealizedIdr: "0",
      unrealizedPct: null,
      priceEffectIdr: null,
      fxEffectIdr: null,
      netWorthIdr: "0",
      netWorthUsesCost: false,
      deposit: null,
      bond: null,
    };
  }

  const valued =
    !costKnown &&
    (inv.type === "deposito" ||
      market === "DEPOSIT" ||
      (!inv.latestPrice && (inv.type === "obligasi" || market === "BOND_ID")) ||
      inv.details?.other?.valuationMethod === "fixed_cost")
      ? null
      : valueByMethod(inv, market, costIdr, todayYmd);
  const rate = valued ? idrPerUnit(ctx.fx, valued.currency) : null;
  if (!valued || !rate) {
    const basis: InvestmentValuationBasis =
      inv.feed?.state === "failed" ? "failed" : "unpriced";
    return {
      ...base,
      basis,
      method: "none",
      reason: valued
        ? "fx_unavailable"
        : !costKnown
          ? "cost_unknown"
          : missingReason(inv),
      price: null,
      valuationFx: null,
      marketValue: null,
      marketValueCurrency: null,
      marketValueIdr: null,
      costRemainingNative: null,
      executionFxAvg: null,
      unrealizedIdr: null,
      unrealizedPct: null,
      priceEffectIdr: null,
      fxEffectIdr: null,
      netWorthIdr: wholeRupiah(costIdr).toFixed(0),
      netWorthUsesCost: true,
      deposit: null,
      bond: null,
    };
  }

  const c = valued.candidate;
  const age = c ? ageDays(c.asOf, todayYmd) : 0;
  const stale = c !== null && staleAfterDays !== null && age > staleAfterDays;
  const valueIdr = valued.value.times(rate);
  const unrealized = valueIdr.minus(costIdr);

  const native = !costKnown
    ? null
    : valued.currency === "IDR"
      ? { currency: "IDR", amount: costIdr }
      : ledger?.costNative?.currency === valued.currency
        ? ledger.costNative
        : null;
  const priceEffect = native
    ? valued.value.minus(native.amount).times(rate)
    : null;
  const fxEffect = native ? native.amount.times(rate).minus(costIdr) : null;

  return {
    ...base,
    basis: basisFor(valued, stale),
    method: valued.method,
    reason: valued.reason,
    price: c
      ? {
          value: c.value.toString(),
          currency: c.currency,
          unitLabel: c.unitLabel,
          source: c.source,
          asOf: c.asOf.toISOString(),
          hasTime: c.hasTime,
          delayed: c.delayed,
          reference: c.reference,
          ageDays: age,
          stale,
          staleAfterDays,
        }
      : null,
    valuationFx: fxDto(ctx.fx, valued.currency),
    marketValue: money(valued.value),
    marketValueCurrency: valued.currency,
    marketValueIdr: money(valueIdr),
    costRemainingNative: native ? money(native.amount) : null,
    executionFxAvg:
      native && valued.currency !== "IDR" && native.amount.greaterThan(0)
        ? costIdr.dividedBy(native.amount).toDecimalPlaces(6).toString()
        : null,
    unrealizedIdr: costKnown ? money(unrealized) : null,
    unrealizedPct: costKnown ? pct(unrealized, costIdr) : null,
    priceEffectIdr: priceEffect ? money(priceEffect) : null,
    fxEffectIdr: fxEffect ? money(fxEffect) : null,
    netWorthIdr: wholeRupiah(valueIdr).toFixed(0),
    netWorthUsesCost: valued.costValued,
    deposit: valued.deposit,
    bond: valued.bond,
  };
}

/** True when the basis is counted in market-value totals (R8). */
export function isPricedBasis(basis: InvestmentValuationBasis): boolean {
  return PRICED_VALUATION_BASES.includes(basis);
}
