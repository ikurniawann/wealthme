/**
 * Aset rebuild contracts (plan rulings A1–A7). Money is a decimal string;
 * `…Idr` figures are rupiah. Percentages are numbers rounded to 2 dp and
 * null when the comparison base is ≤ 0 or unknown — never Infinity, never
 * -100% from a missing price (same convention as Investasi valuation).
 */
import type { InvestmentValuationBasis } from "../investments/valuation.js";

/**
 * A1 — one valuation vocabulary for every overview row. Investment rows
 * take their basis from the Investasi valuation service (no second
 * formula); account and physical-asset rows use the same labels:
 * market | manual | stale | cost_basis | unpriced | failed | zero_valid.
 */
export {
  INVESTMENT_VALUATION_BASES as ASSET_VALUATION_BASES,
  PRICED_VALUATION_BASES as ASSET_PRICED_VALUATION_BASES,
} from "../investments/valuation.js";
export type AssetValuationBasis = InvestmentValuationBasis;

/** A2 — what the row is (classification), independent of storage/source. */
export const ASSET_CLASSES = [
  "dana_rekening",
  "investasi",
  "aset_fisik",
  "lainnya",
] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

/** A2 — the module that owns the record (where edits happen). */
export const ASSET_SOURCE_MODULES = [
  "accounts",
  "investments",
  "assets",
] as const;
export type AssetSourceModule = (typeof ASSET_SOURCE_MODULES)[number];

/** A5 — mirrors Prisma `AssetStatus`. Delete becomes archive. */
export const ASSET_STATUSES = ["active", "sold", "archived"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

/** A5 — mirrors Prisma `AssetValuationModel`. */
export const ASSET_VALUATION_MODELS = ["per_unit", "total"] as const;
export type AssetValuationModel = (typeof ASSET_VALUATION_MODELS)[number];

/** A4 — mirrors Prisma `AssetHistoryKind`. */
export const ASSET_HISTORY_KINDS = [
  "opening",
  "valuation",
  "correction",
  "buy",
  "sell",
  "quantity_change",
] as const;
export type AssetHistoryKind = (typeof ASSET_HISTORY_KINDS)[number];

/** A5 — mirrors Prisma `AssetTransactionKind`. */
export const ASSET_TRANSACTION_KINDS = ["opening", "buy", "sell"] as const;
export type AssetTransactionKind = (typeof ASSET_TRANSACTION_KINDS)[number];

/** Mirrors Prisma `AssetEventStatus` (history rows and transactions). */
export const ASSET_EVENT_STATUSES = ["active", "void"] as const;
export type AssetEventStatus = (typeof ASSET_EVENT_STATUSES)[number];
export interface AssetSourceLink {
  module: AssetSourceModule;
  id: string;
  href: string;
}
export interface AssetPriceDto {
  value: string;
  currency: string;
  unitLabel: string | null;
  source: string;
  asOf: string;
  hasTime: boolean;
  timeZone: string | null;
  fxRate?: string | null;
  fxRateDate?: string | null;
  fxSource?: string | null;
}
/**
 * A6 — valuation change only (buy/sell effects are never counted as price
 * change). amount = new − previous by effective order; percent = amount /
 * previous × 100, null when previous ≤ 0 or unknown. `period: "none"` means
 * no valid comparison exists ("Belum ada valuasi pembanding"), not 0.
 */
export interface AssetValueChangeDto {
  amountIdr: string | null;
  percent: number | null;
  /** yyyy-mm-dd of the comparison valuation. */
  comparisonDate: string | null;
  period: "previous_valuation" | "previous_day" | "none";
}
export interface AssetOverviewRowDto {
  id: string;
  name: string;
  internalCode: string | null;
  ticker: string | null;
  class: AssetClass;
  subtype: string;
  sourceModule: AssetSourceModule;
  sourceId: string;
  sources: AssetSourceLink[];
  ownerUserId: string | null;
  ownerName: string | null;
  custodian: string | null;
  platformAccountId: string | null;
  quantity: string | null;
  unit: string | null;
  acquisition: { date: string | null; multiple: boolean };
  status: AssetStatus;
  valuationBasis: AssetValuationBasis;
  /** Null is unknown, never coerced into a market-value zero. */
  valueIdr: string | null;
  displayValue: string | null;
  displayCurrency: string;
  /** Market value, or explicitly labelled cost fallback for net worth. */
  netWorthValueIdr: string;
  costBasisIdr: string | null;
  price: AssetPriceDto | null;
  change: AssetValueChangeDto;
  /** A6 — value − remaining cost basis; null when either is unknown. */
  unrealizedPnlIdr: string | null;
  unrealizedPnlPercent: number | null;
  /**
   * A3 — a possible duplicate the user should review (e.g. an
   * Account.type=property next to an Asset properti). Never auto-merged.
   */
  duplicateWarning: boolean;
}
export interface AssetsOverviewSummaryDto {
  grossTotalIdr: string;
  pricedTotalIdr: string;
  unpricedCostIdr: string;
  danaRekeningIdr: string;
  investasiIdr: string;
  asetFisikIdr: string;
  lainnyaIdr: string;
  netWorthIdr: string | null;
  liabilitiesIdr: string | null;
  valuationDate: string;
  displayCurrency: string;
  displayGrossTotal: string | null;
  displayDanaRekening: string | null;
  displayInvestasi: string | null;
  displayAsetFisik: string | null;
  displayLainnya: string | null;
  displayNetWorth: string | null;
  incomplete: boolean;
  scope: "filtered" | "all";
}
export interface AssetsOverviewQuery {
  q?: string;
  class?: AssetClass;
  subtype?: string;
  ownerUserId?: string;
  platformAccountId?: string;
  custodian?: string;
  minValue?: string;
  maxValue?: string;
  minQuantity?: string;
  maxQuantity?: string;
  unit?: string;
  acquiredFrom?: string;
  acquiredTo?: string;
  status?: AssetStatus;
  completeness?: "complete" | "incomplete";
  sort?: "value_desc" | "value_asc" | "name_asc" | "acquired_desc";
  displayCurrency?: string;
  page?: number;
  limit?: number;
}
export interface AssetsOverviewDto {
  rows: AssetOverviewRowDto[];
  summary: AssetsOverviewSummaryDto;
  meta: { total: number; page: number; limit: number; totalPages: number };
}
export interface AssetTransactionDto {
  id: string;
  assetId: string;
  familyGroupId: string;
  kind: AssetTransactionKind;
  status: AssetEventStatus;
  quantity: string;
  pricePerUnit: string | null;
  grossAmount: string | null;
  fee: string;
  tax: string;
  netAmount: string | null;
  currency: string;
  fxRate: string | null;
  costBasisKnown: boolean;
  realizedPnlIdr: string | null;
  effectiveDate: string;
  effectiveTime: string | null;
  timeZone: string | null;
  cashAccountId: string | null;
  cashTransactionId: string | null;
  idempotencyKey: string;
  note: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  voidedAt: string | null;
  voidReason: string | null;
}
/**
 * POST .../assets/:id/transactions — buy / sell / opening (A5). Same rules
 * as the Investasi ledger: weighted-average cost (R1), ordering (R6),
 * `idempotencyKey` uuid per form open (R7; a replay returns the original
 * result). `opening` never moves cash; buy/sell move `cashAccountId`.
 */
export interface CreateAssetTransactionInput {
  kind: AssetTransactionKind;
  idempotencyKey: string;
  quantity: string;
  pricePerUnit?: string;
  grossAmount?: string;
  fee?: string;
  tax?: string;
  currency: string;
  fxRate?: string | null;
  costBasisKnown?: boolean;
  effectiveDate: string;
  effectiveTime?: string | null;
  timeZone?: string | null;
  cashAccountId?: string | null;
  note?: string | null;
}
export type UpdateAssetTransactionInput = Partial<
  Omit<CreateAssetTransactionInput, "kind" | "idempotencyKey">
> & { reason?: string | null };
/**
 * POST .../assets/:id/valuations (and /preview). Exactly one of
 * `pricePerUnit` (valuationModel per_unit) or `value` (total). Never moves
 * cash or cost basis.
 */
export interface AssetValuationInput {
  pricePerUnit?: string;
  value?: string;
  currency: string;
  fxRate?: string | null;
  effectiveDate: string;
  effectiveTime?: string | null;
  timeZone?: string | null;
  source: string;
  reference?: string | null;
  note?: string | null;
}
export interface AssetValuationPreviewDto {
  quantity: string | null;
  unit: string | null;
  valuationModel: AssetValuationModel;
  previousValueIdr: string | null;
  newValueIdr: string;
  changeIdr: string | null;
  changePercent: number | null;
  totalImpactIdr: string;
  backdated: boolean;
  comparisonDate: string | null;
  currency: string;
  fxRate: string | null;
}
/**
 * A4 — one history event. Deterministic order: (effectiveDate, date-only
 * before timed, effectiveAt, createdAt, id). `recordedAt`/`createdAt` are
 * when it was written, never used to decide which valuation is newest.
 */
export interface AssetHistoryEventDto {
  id: string;
  assetId: string;
  value: string;
  effectiveAt: string;
  /** yyyy-mm-dd, calendar date in `timeZone` (Asia/Jakarta when null). */
  effectiveDate: string;
  /** False = only the date is known; no clock time is shown. */
  hasTime: boolean;
  timeZone: string | null;
  recordedAt: string;
  createdAt: string;
  kind: AssetHistoryKind;
  source: string;
  reference: string | null;
  status: AssetEventStatus;
  valuationModel: AssetValuationModel;
  pricePerUnit: string | null;
  currency: string;
  fxRate: string | null;
  fxRateDate?: string | null;
  fxSource?: string | null;
  quantityBefore: string | null;
  quantityAfter: string | null;
  unit: string | null;
  valueBefore: string | null;
  changeIdr: string | null;
  changePercent: number | null;
  recordedByUserId: string | null;
  recordedByName: string | null;
  note: string | null;
  assetTransactionId: string | null;
  voidedAt: string | null;
  voidReason: string | null;
}

/** PATCH .../assets/:id/valuations/:historyId — any subset, audited. */
export type UpdateAssetValuationInput = Partial<AssetValuationInput> & {
  reason?: string | null;
};

/** POST .../void on a valuation or transaction; the row is kept, audited. */
export interface VoidAssetEventInput {
  reason?: string | null;
}

/** The asset's ledger state after a transaction replay. */
export interface AssetHoldingStateDto {
  id: string;
  quantity: string | null;
  unit: string | null;
  /** Weighted-average cost per unit, IDR (R1); null when unknown. */
  costBasisPerUnit: string | null;
  costBasisKnown: boolean;
  /** Σ realized P/L of active sells, IDR; null when nothing was sold. */
  realizedPnlIdr: string | null;
  status: AssetStatus;
}

export interface AssetTransactionResultDto {
  /** True when an earlier request with the same idempotencyKey answered. */
  replayed: boolean;
  transaction: AssetTransactionDto;
  asset: AssetHoldingStateDto;
}
