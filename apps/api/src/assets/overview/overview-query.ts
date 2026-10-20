import { BadRequestException } from "@nestjs/common";

import {
  OVERVIEW_DEFAULT_LIMIT,
  OVERVIEW_MAX_LIMIT,
} from "../dto/assets-overview-query.dto";

import { D, ZERO, money } from "./overview-model";

import type { BuiltRow, Decimal, DisplayFn } from "./overview-model";
import type { AssetsOverviewQueryDto } from "../dto/assets-overview-query.dto";
import type {
  AssetOverviewRowDto,
  AssetsOverviewSummaryDto,
} from "@wealthme/contracts";

/**
 * One rule for "valuation incomplete", shared by the completeness filter and
 * `summary.incomplete`: no usable price (cost_basis rows carry a labelled
 * value and count as complete in both).
 */
const MISSING_BASES = new Set(["unpriced", "failed"]);

/** Keys that narrow the row set; sort/paging/currency never do. */
const FILTER_KEYS = [
  "q",
  "class",
  "subtype",
  "ownerUserId",
  "platformAccountId",
  "custodian",
  "minValue",
  "maxValue",
  "minQuantity",
  "maxQuantity",
  "unit",
  "acquiredFrom",
  "acquiredTo",
  "status",
  "completeness",
] as const;

export function isFiltered(q: AssetsOverviewQueryDto): boolean {
  return FILTER_KEYS.some((k) => q[k] !== undefined && q[k] !== "");
}

function sameUnit(a: string | null, b: string): boolean {
  return a !== null && a.trim().toLowerCase() === b.trim().toLowerCase();
}

function inRange(
  v: string | null,
  min: string | undefined,
  max: string | undefined,
): boolean {
  if (min === undefined && max === undefined) return true;
  if (v === null) return false;
  const d = new D(v);
  if (min !== undefined && d.lessThan(min)) return false;
  if (max !== undefined && d.greaterThan(max)) return false;
  return true;
}

export function assertQuery(q: AssetsOverviewQueryDto): void {
  const hasQty = q.minQuantity !== undefined || q.maxQuantity !== undefined;
  if (hasQty && !q.unit) {
    throw new BadRequestException(
      "Rentang kuantitas memerlukan satuan (unit): gram, lembar dan unit tidak dibandingkan",
    );
  }
  if (q.minValue && q.maxValue && new D(q.minValue).greaterThan(q.maxValue)) {
    throw new BadRequestException("minValue lebih besar dari maxValue");
  }
  if (q.acquiredFrom && q.acquiredTo && q.acquiredFrom > q.acquiredTo) {
    throw new BadRequestException("acquiredFrom setelah acquiredTo");
  }
}

function matches(r: BuiltRow, q: AssetsOverviewQueryDto): boolean {
  const d = r.dto;
  const status = q.status ?? "active";
  if (d.status !== status) return false;
  if (q.q && !r.search.includes(q.q.trim().toLowerCase())) return false;
  if (q.class && d.class !== q.class) return false;
  if (q.subtype && d.subtype !== q.subtype) return false;
  if (q.ownerUserId && d.ownerUserId !== q.ownerUserId) return false;
  if (q.platformAccountId && d.platformAccountId !== q.platformAccountId) {
    return false;
  }
  if (
    q.custodian &&
    !(d.custodian ?? "").toLowerCase().includes(q.custodian.toLowerCase())
  ) {
    return false;
  }
  // Money bounds compare rupiah value only; an unvalued row has no value
  // to compare and is left out (never treated as 0).
  if (!inRange(d.valueIdr, q.minValue, q.maxValue)) return false;
  if (q.unit) {
    // Quantities compare only within one unit (spec §3).
    if (!sameUnit(d.unit, q.unit)) return false;
    if (!inRange(d.quantity, q.minQuantity, q.maxQuantity)) return false;
  }
  const acquired = d.acquisition.date;
  if (q.acquiredFrom && (!acquired || acquired < q.acquiredFrom)) return false;
  if (q.acquiredTo && (!acquired || acquired > q.acquiredTo)) return false;
  if (q.completeness) {
    const incomplete =
      d.valueIdr === null || MISSING_BASES.has(d.valuationBasis);
    if ((q.completeness === "incomplete") !== incomplete) return false;
  }
  return true;
}

function valueKey(d: AssetOverviewRowDto): Decimal | null {
  return d.valueIdr === null ? null : new D(d.valueIdr);
}

/** Nulls (unvalued / undated) always sort last, whatever the direction. */
function compare(
  a: AssetOverviewRowDto,
  b: AssetOverviewRowDto,
  sort: NonNullable<AssetsOverviewQueryDto["sort"]>,
): number {
  let c = 0;
  if (sort === "value_desc" || sort === "value_asc") {
    const va = valueKey(a);
    const vb = valueKey(b);
    if (va === null || vb === null) c = va === vb ? 0 : va === null ? 1 : -1;
    else c = sort === "value_desc" ? vb.comparedTo(va) : va.comparedTo(vb);
  } else if (sort === "acquired_desc") {
    const da = a.acquisition.date;
    const db = b.acquisition.date;
    if (da === null || db === null) c = da === db ? 0 : da === null ? 1 : -1;
    else c = db.localeCompare(da);
  }
  if (c !== 0) return c;
  return (
    a.name.localeCompare(b.name, "id", { sensitivity: "base" }) ||
    a.id.localeCompare(b.id)
  );
}

export function selectRows(
  rows: BuiltRow[],
  q: AssetsOverviewQueryDto,
): BuiltRow[] {
  const sort = q.sort ?? "value_desc";
  return rows
    .filter((r) => matches(r, q))
    .sort((a, b) => compare(a.dto, b.dto, sort));
}

export function paginate<T>(
  rows: T[],
  q: AssetsOverviewQueryDto,
): {
  page: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
} {
  const limit = Math.min(q.limit ?? OVERVIEW_DEFAULT_LIMIT, OVERVIEW_MAX_LIMIT);
  const totalPages = Math.max(1, Math.ceil(rows.length / limit));
  const page = Math.min(q.page ?? 1, totalPages);
  return {
    page: rows.slice((page - 1) * limit, page * limit),
    meta: { total: rows.length, page, limit, totalPages },
  };
}

/** Σ net-worth figures of counted rows (labelled cost fallback included). */
export function countedTotal(rows: BuiltRow[]): Decimal {
  return rows
    .filter((r) => r.counted)
    .reduce((s, r) => s.plus(r.dto.netWorthValueIdr), ZERO);
}

export interface SummaryInput {
  rows: BuiltRow[];
  filtered: boolean;
  netWorthIdr: Decimal | null;
  liabilitiesIdr: Decimal | null;
  valuationDate: string;
  displayCurrency: string;
  display: DisplayFn;
}

/**
 * The summary strip. Gross = Σ counted rows at their net-worth figure (an
 * unpriced holding at its labelled remaining cost, R8), split by class.
 * `incomplete` when any counted row has no usable price. Net worth is a
 * separate metric over ALL visible rows (never the filtered subset).
 */
export function summarize(s: SummaryInput): AssetsOverviewSummaryDto {
  const by = {
    dana_rekening: ZERO,
    investasi: ZERO,
    aset_fisik: ZERO,
    polis_asuransi: ZERO,
    lainnya: ZERO,
  };
  let priced = ZERO;
  let unpricedCost = ZERO;
  let incomplete = false;
  for (const r of s.rows) {
    if (!r.counted) continue;
    const d = r.dto;
    by[d.class] = by[d.class].plus(d.netWorthValueIdr);
    if (d.valueIdr === null) {
      unpricedCost = unpricedCost.plus(d.netWorthValueIdr);
    } else {
      priced = priced.plus(d.valueIdr);
    }
    if (MISSING_BASES.has(d.valuationBasis)) incomplete = true;
  }
  const gross = by.dana_rekening
    .plus(by.investasi)
    .plus(by.aset_fisik)
    .plus(by.polis_asuransi)
    .plus(by.lainnya);
  const m = (d: Decimal | null) => (d === null ? null : money(d));
  return {
    grossTotalIdr: money(gross),
    pricedTotalIdr: money(priced),
    unpricedCostIdr: money(unpricedCost),
    danaRekeningIdr: money(by.dana_rekening),
    investasiIdr: money(by.investasi),
    asetFisikIdr: money(by.aset_fisik),
    polisAsuransiIdr: money(by.polis_asuransi),
    lainnyaIdr: money(by.lainnya),
    netWorthIdr: m(s.netWorthIdr),
    liabilitiesIdr: m(s.liabilitiesIdr),
    valuationDate: s.valuationDate,
    displayCurrency: s.displayCurrency,
    displayGrossTotal: s.display(money(gross)),
    displayDanaRekening: s.display(money(by.dana_rekening)),
    displayInvestasi: s.display(money(by.investasi)),
    displayAsetFisik: s.display(money(by.aset_fisik)),
    displayPolisAsuransi: s.display(money(by.polis_asuransi)),
    displayLainnya: s.display(money(by.lainnya)),
    displayNetWorth: s.display(m(s.netWorthIdr)),
    incomplete,
    scope: s.filtered ? "filtered" : "all",
  };
}
