import { dbDateToYmd } from "../../investments/ledger/ledger-dates";

import {
  D,
  NO_CHANGE,
  money,
  ownerName,
  pctOf,
  searchText,
} from "./overview-model";

import type { Acquisition } from "./investment-rows";
import type { BuiltRow, Decimal, RowContext } from "./overview-model";
import type {
  AssetHistoryKind,
  AssetStatus,
  AssetType,
  AssetValuationModel,
} from "@prisma/client";
import type { AssetPriceDto, AssetValueChangeDto } from "@wealthme/contracts";

export interface OverviewAsset {
  id: string;
  name: string;
  type: AssetType;
  currentValue: bigint;
  ownerUserId: string | null;
  quantity: Decimal | null;
  unit: string | null;
  valuationModel: AssetValuationModel;
  costBasisPerUnit: Decimal | null;
  internalCode: string | null;
  custodian: string | null;
  status: AssetStatus;
  acquisitionDate: Date | null;
}

/** One active history row, newest first by the A4 effective order. */
export interface OverviewHistory {
  assetId: string;
  value: bigint;
  kind: AssetHistoryKind;
  effectiveAt: Date;
  effectiveDate: Date;
  hasTime: boolean;
  timeZone: string | null;
  source: string;
  pricePerUnit: Decimal | null;
  currency: string;
  fxRate: Decimal | null;
  fxRateDate: Date | null;
  fxSource: string | null;
  unit: string | null;
}

const VALUATION_KINDS: ReadonlySet<AssetHistoryKind> = new Set([
  "opening",
  "valuation",
  "correction",
]);
const QUANTITY_KINDS: ReadonlySet<AssetHistoryKind> = new Set([
  "buy",
  "sell",
  "quantity_change",
]);

function priceDto(h: OverviewHistory | undefined): AssetPriceDto | null {
  if (!h) return null;
  const perUnit = h.pricePerUnit !== null;
  return {
    value: perUnit ? h.pricePerUnit!.toString() : h.value.toString(),
    currency: perUnit ? h.currency : "IDR",
    unitLabel: perUnit && h.unit ? `per ${h.unit}` : null,
    source: h.source,
    // Date-only rows carry no clock time: send the calendar date.
    asOf: h.hasTime
      ? h.effectiveAt.toISOString()
      : `${dbDateToYmd(h.effectiveDate)}T00:00:00.000Z`,
    hasTime: h.hasTime,
    timeZone: h.timeZone,
    fxRate: perUnit && h.fxRate ? h.fxRate.toString() : null,
    fxRateDate: perUnit && h.fxRateDate ? dbDateToYmd(h.fxRateDate) : null,
    fxSource: perUnit ? h.fxSource : null,
  };
}

/**
 * A6 — change since the previous valuation by effective order. When a
 * buy/sell/quantity change sits between the two valuations, the value
 * difference is not a price move: it is then measured per unit (IDR prices
 * on both rows) at today's quantity, or reported as "none".
 */
export function assetChange(
  history: OverviewHistory[],
  quantity: Decimal | null,
): AssetValueChangeDto {
  const latestIdx = history.findIndex((h) => VALUATION_KINDS.has(h.kind));
  if (latestIdx < 0) return NO_CHANGE;
  const latest = history[latestIdx]!;
  let crossed = false;
  for (const h of history.slice(latestIdx + 1)) {
    if (QUANTITY_KINDS.has(h.kind)) {
      crossed = true;
      continue;
    }
    if (!VALUATION_KINDS.has(h.kind)) continue;
    const comparisonDate = dbDateToYmd(h.effectiveDate);
    if (!crossed) {
      const prev = new D(h.value.toString());
      const diff = new D(latest.value.toString()).minus(prev);
      return {
        amountIdr: money(diff),
        percent: pctOf(diff, prev),
        comparisonDate,
        period: "previous_valuation",
      };
    }
    const a = latest.pricePerUnit;
    const b = h.pricePerUnit;
    if (!a || !b || !quantity || latest.currency !== "IDR") return NO_CHANGE;
    if (h.currency !== "IDR") return NO_CHANGE;
    const diff = a.minus(b);
    return {
      amountIdr: money(diff.times(quantity)),
      percent: pctOf(diff, b),
      comparisonDate,
      period: "previous_valuation",
    };
  }
  return NO_CHANGE;
}

export function physicalRow(
  a: OverviewAsset,
  history: OverviewHistory[],
  acquisition: Acquisition | null,
  ctx: RowContext,
  duplicateWarning: boolean,
): BuiltRow {
  const value = a.currentValue.toString();
  const cost =
    a.costBasisPerUnit && a.quantity
      ? a.costBasisPerUnit.times(a.quantity)
      : null;
  const unrealized = cost ? new D(value).minus(cost) : null;
  const latest = history.find((h) => VALUATION_KINDS.has(h.kind)) ?? history[0];
  return {
    counted: a.status === "active",
    search: searchText(a.name, a.internalCode, a.custodian),
    dto: {
      id: `assets:${a.id}`,
      name: a.name,
      internalCode: a.internalCode,
      ticker: null,
      class: a.type === "lainnya" ? "lainnya" : "aset_fisik",
      subtype: a.type,
      sourceModule: "assets",
      sourceId: a.id,
      sources: [{ module: "assets", id: a.id, href: `/aset/${a.id}` }],
      ownerUserId: a.ownerUserId,
      ownerName: ownerName(ctx, a.ownerUserId),
      custodian: a.custodian,
      platformAccountId: null,
      quantity: a.quantity?.toString() ?? null,
      unit: a.unit,
      acquisition: acquisition ?? {
        date: a.acquisitionDate ? dbDateToYmd(a.acquisitionDate) : null,
        multiple: false,
      },
      status: a.status,
      // The recorded value is user-entered (A4 latest valuation); a recorded
      // zero is a real zero, never a missing price.
      valuationBasis: a.currentValue === 0n ? "zero_valid" : "manual",
      valueIdr: value,
      displayValue: ctx.display(value),
      displayCurrency: ctx.displayCurrency,
      netWorthValueIdr: value,
      costBasisIdr: cost ? money(cost) : null,
      price: priceDto(latest),
      change: assetChange(history, a.quantity),
      unrealizedPnlIdr: unrealized ? money(unrealized) : null,
      unrealizedPnlPercent: unrealized ? pctOf(unrealized, cost) : null,
      duplicateWarning,
    },
  };
}
