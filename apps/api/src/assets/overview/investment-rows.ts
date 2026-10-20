import { MARKETS } from "@wealthme/contracts";

import { dbDateToYmd } from "../../investments/ledger/ledger-dates";
import {
  isPricedBasis,
  jakartaYmd,
} from "../../investments/valuation/valuation-core";
import { historyEffectiveFields } from "../history-effective.util";

import {
  D,
  NO_CHANGE,
  money,
  ownerName,
  pctOf,
  searchText,
} from "./overview-model";

import type { BuiltRow, Decimal, RowContext } from "./overview-model";
import type { ValuedHolding } from "../../investments/valuation/investment-valuation.service";
import type {
  AssetPriceDto,
  AssetValueChangeDto,
  InvestmentDetails,
  InvestmentValuationDto,
} from "@wealthme/contracts";

/** The price observation just before the one the valuation used. */
export interface PreviousPrice {
  price: Decimal;
  currency: string;
  unitLabel: string | null;
  asOf: Date | null;
  recordedAt: Date;
}

export interface LinkedAsset {
  id: string;
  internalCode: string | null;
  custodian: string | null;
}

export interface Acquisition {
  date: string | null;
  multiple: boolean;
}

export interface InvestmentRowInput {
  holding: ValuedHolding;
  platformName: string | null;
  previous: PreviousPrice | null;
  acquisition: Acquisition | null;
  linkedAsset: LinkedAsset | null;
}

function priceDto(v: InvestmentValuationDto): AssetPriceDto | null {
  if (!v.price) return null;
  return {
    value: v.price.value,
    currency: v.price.currency,
    unitLabel: v.price.unitLabel,
    source: v.price.source,
    asOf: v.price.asOf,
    hasTime: v.price.hasTime,
    timeZone: null,
    fxRate: v.valuationFx?.idrPerUnit ?? null,
    fxRateDate: v.valuationFx?.rateDate ?? null,
    fxSource: v.valuationFx?.source ?? null,
  };
}

/**
 * A6 — price change since the previous stored price, at today's quantity
 * and valuation FX, so a buy/sell never reads as a price move. Only for the
 * plain `price` method (gold family price, deposit accrual and bonds have
 * no comparable previous observation) and only between two prices in the
 * same currency and unit.
 */
function priceChange(
  v: InvestmentValuationDto,
  prev: PreviousPrice | null,
): AssetValueChangeDto {
  const p = v.price;
  if (!p || !prev || v.method !== "price" || !isPricedBasis(v.basis)) {
    return NO_CHANGE;
  }
  if (prev.currency !== p.currency) return NO_CHANGE;
  // A6 — a zero/unknown previous price has no comparable change ("—").
  if (!prev.price.greaterThan(0)) return NO_CHANGE;
  if ((prev.unitLabel ?? p.unitLabel) !== p.unitLabel) return NO_CHANGE;
  const rate =
    p.currency === "IDR"
      ? new D(1)
      : v.valuationFx
        ? new D(v.valuationFx.idrPerUnit)
        : null;
  if (!rate) return NO_CHANGE;
  const diff = new D(p.value).minus(prev.price);
  const at = prev.asOf ?? prev.recordedAt;
  return {
    amountIdr: money(diff.times(v.quantity).times(rate)),
    percent: pctOf(diff, prev.price),
    comparisonDate: jakartaYmd(at),
    period: "previous_valuation",
  };
}

function quantityUnit(v: InvestmentValuationDto, details: unknown): string {
  const gold = (details as InvestmentDetails | null)?.gold;
  if (v.type === "emas" && gold?.unit) return gold.unit;
  return MARKETS[v.market].baseUnit;
}

/**
 * A1/A2 — one row per holding, valued ONLY by the shared Investasi
 * valuation (Task 8). Unpriced/failed → valueIdr null with that basis,
 * never Rp0 (the NVDA bug); net worth keeps the labelled cost fallback
 * (R8). A linked physical asset (A3) is the same row with two sources.
 */
export function investmentRow(
  input: InvestmentRowInput,
  ctx: RowContext,
  duplicateWarning: boolean,
): BuiltRow {
  const { row, valuation: v } = input.holding;
  const linked = input.linkedAsset;
  const valueIdr = isPricedBasis(v.basis) ? v.marketValueIdr : null;
  const sold = v.basis === "zero_valid";
  const custodian = input.platformName ?? linked?.custodian ?? null;
  // Same date-only rule as asset history: a UTC-midnight purchasedAt is a
  // calendar date; any other instant is dated in Asia/Jakarta.
  const fallbackDate = row.purchasedAt
    ? dbDateToYmd(historyEffectiveFields(row.purchasedAt).effectiveDate)
    : null;
  return {
    // A fully sold holding (quantity 0) is a true zero; kept out of sums.
    counted: !sold,
    search: searchText(row.name, row.ticker, custodian, linked?.internalCode),
    dto: {
      id: `investments:${row.id}`,
      name: row.name,
      internalCode: linked?.internalCode ?? null,
      ticker: row.ticker || null,
      class: "investasi",
      subtype: row.type,
      sourceModule: "investments",
      sourceId: row.id,
      sources: [
        { module: "investments", id: row.id, href: `/investasi/${row.id}` },
        ...(linked
          ? [
              {
                module: "assets" as const,
                id: linked.id,
                href: `/aset/${linked.id}`,
              },
            ]
          : []),
      ],
      ownerUserId: row.ownerUserId,
      ownerName: ownerName(ctx, row.ownerUserId),
      custodian,
      platformAccountId: row.platformAccountId,
      quantity: v.quantity,
      unit: quantityUnit(v, row.details),
      acquisition: input.acquisition ?? { date: fallbackDate, multiple: false },
      status: sold ? "sold" : "active",
      valuationBasis: v.basis,
      valueIdr,
      displayValue: ctx.display(valueIdr),
      displayCurrency: ctx.displayCurrency,
      netWorthValueIdr: v.netWorthIdr,
      costBasisIdr: v.costRemainingIdr,
      price: priceDto(v),
      change: priceChange(v, input.previous),
      unrealizedPnlIdr: valueIdr === null ? null : v.unrealizedIdr,
      unrealizedPnlPercent: valueIdr === null ? null : v.unrealizedPct,
      duplicateWarning,
    },
  };
}
