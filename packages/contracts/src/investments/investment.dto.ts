import type { InvestmentMarket } from "./markets.js";

export type InvestmentType =
  | "saham"
  | "reksa_dana"
  | "obligasi"
  | "emas"
  | "kripto"
  | "lainnya"
  // EPIC-024 C2 (D10) — nominal, bunga %/thn (simple interest), tanggal
  // mulai + jatuh tempo. Manual-priced (never reaches MarketDataPort).
  | "deposito";

export interface InvestmentDto {
  id: string;
  familyGroupId: string;
  ticker: string;
  name: string;
  type: InvestmentType;
  quantity: string; // Decimal serialized as string
  costBasisPerUnit: string;
  currentPrice: string | null;
  currentValue: string | null;
  returnRp: string | null;
  returnPct: number | null;
  currency: string;
  notes: string | null;
  // EPIC-021 #20: latest price provenance, for the "online stock detail" row.
  latestPriceRecordedAt: string | null;
  latestPriceSource: string | null;
  // EPIC-023 G1 (D15) — `latestPriceAsOf` is the provider's own quote time
  // (falls back to `latestPriceRecordedAt` for legacy rows);
  // `latestPriceDelayed` is true only for feeds that must be labelled
  // delayed/unofficial (Yahoo `.JK`). Both null when no price exists yet —
  // the manual-only types (reksa_dana, obligasi, emas, lainnya) show an
  // honest "input manual" prompt in that case, never a fabricated figure.
  latestPriceAsOf: string | null;
  latestPriceDelayed: boolean | null;
  // EPIC-023 Task G retry (MEDIUM finding) — true only when THIS request
  // attempted a fresh automated quote and the feed failed, so the price
  // shown below is a RETAINED (stale) one, not a fresh tick. Always false
  // for manual prices and for a price that didn't need refreshing yet.
  priceRefreshFailed: boolean;
  // EPIC-024 C1 (D8) — true only for an automated-price type (saham/kripto)
  // whose ticker has NO route to a live feed (e.g. no CoinGecko id
  // mapping). Distinct from `priceRefreshFailed`: that flag means "a live
  // feed exists but this attempt failed" (transient, worth retrying);
  // this one means "no live feed will ever exist for this ticker" — the UI
  // shows a permanent "harga manual" fallback badge instead of a
  // refresh-failed warning, and the edit form accepts a manual price for
  // it even though the instrument type is normally automated-only.
  automatedPriceUnmapped: boolean;
  // Batch B6 (client revision round 2) — true only when the latest
  // automated-feed price row is a dev/demo simulated quote ("mock" source,
  // MockMarketDataAdapter), never a real market price. A real holding must
  // never be valued off a fabricated number: when true, `currentPrice` is
  // null and `currentValue` falls back to cost basis × quantity, and the UI
  // shows "harga belum tersedia, perbarui manual" instead of a "Live" badge.
  automatedPriceSimulated: boolean;
  // Annual interest rate (%) for interest-bearing instruments (obligasi,
  // deposito). Null when not applicable/not set.
  interestRatePct: string | null;
  // Simple projected annual yield = currentValue × interestRatePct / 100.
  // Null when either currentValue or interestRatePct is unavailable.
  projectedAnnualYield: string | null;
  // EPIC-024 C2/C3 (D7) — "tanggal beli", recorded for every instrument
  // type so a holding's history starts from the truth (US-INV-10). Null on
  // rows created before this column existed.
  purchasedAt: string | null;
  // EPIC-024 C2/C3 (D10) — deposito's jatuh tempo; null for every other
  // type and for a deposito that hasn't had one set yet.
  maturityDate: string | null;
  // EPIC-022 D2 — sum of `realizedPnl` across every SELL transaction ever
  // recorded against this holding (see InvestmentTransactionDto). Null when
  // no sell has ever been recorded (never a fabricated "0" — distinct from
  // "sold at exactly break-even").
  realizedPnlRp: string | null;
  // ── Investasi rebuild (R2, R4, R5) — optional so older fixtures still
  // type-check; the API always sends them. ──
  /** Null on legacy rows the migration could not classify ("Lengkapi pasar"). */
  market?: InvestmentMarket | null;
  /** Base units per lot (IDX saham 100, else 1). Quantity is never in lots. */
  lotSize?: number;
  /** Null = MARKETS[market].allowFractionDefault. */
  allowFraction?: boolean | null;
  /** Provider symbol (BBCA.JK, NVDA, bitcoin), separate from `ticker`. */
  priceSymbol?: string | null;
  ownerUserId?: string | null;
  platformAccountId?: string | null;
  cashAccountId?: string | null;
  details?: InvestmentDetails | null;
  createdAt: string;
  updatedAt: string;
}

// ── Type-specific holding data (Investment.details JSON) ─────────────────────
// Every field optional: the user records what they know; nothing is invented.

export type BondPriceConvention = "percent_of_par" | "per_unit";

export interface BondDetails {
  /** ISIN / series code (FR0100, ORI025). */
  instrumentCode?: string;
  issuer?: string;
  /** Face value (nominal pokok) held, in the holding currency. */
  principal?: string;
  priceConvention?: BondPriceConvention;
  /** True when recorded prices include accrued interest (dirty). */
  pricesIncludeAccrued?: boolean;
  couponRatePct?: string;
  /** Coupons per year (12 monthly, 2 semi-annual). */
  couponFrequency?: number;
  /** yyyy-mm-dd. */
  maturityDate?: string;
}

export type GoldForm = "physical" | "digital";

export interface GoldDetails {
  form?: GoldForm;
  /** "gram" by default; kept as text for troy-ounce or other units. */
  unit?: string;
  /** Fineness, e.g. "999.9" or "24K". */
  purity?: string;
  /** Brand/minter (Antam, UBS) or custodian for digital gold. */
  brand?: string;
}

export type DepositRollover = "aro" | "aro_plus" | "non_aro";

export interface DepositDetails {
  bankName?: string;
  /** yyyy-mm-dd. */
  startDate?: string;
  /** yyyy-mm-dd. */
  maturityDate?: string;
  ratePct?: string;
  rollover?: DepositRollover;
}

export type OtherValuationMethod = "manual_price" | "fixed_cost";

export interface OtherDetails {
  /** What one unit is ("unit", "lembar sertifikat", "ekor"). */
  unit?: string;
  valuationMethod?: OtherValuationMethod;
}

/** Investment.details — keyed by the slice that applies to the holding's type. */
export interface InvestmentDetails {
  bond?: BondDetails;
  gold?: GoldDetails;
  deposit?: DepositDetails;
  other?: OtherDetails;
}

// ── Platform accounts and pockets (R2) ──────────────────────────────────────

export interface PlatformAccountDto {
  id: string;
  familyGroupId: string;
  /** INVESTMENT_PLATFORMS key or "custom". */
  platformKey: string;
  customName: string | null;
  ownerUserId: string | null;
  label: string | null;
  /** Decrypted for the response; stored encrypted. */
  accountRef: string | null;
  syncMode: "manual";
  createdAt: string;
  updatedAt: string;
}

// EPIC-022 D2 — the only two investment-transaction kinds. Buy grows the
// position and recomputes a weighted-average costBasisPerUnit; sell shrinks
// it and books a realized P/L for the sold portion.
export type InvestmentTxType = "buy" | "sell";

// Investasi rebuild — canonical ledger classification (Prisma InvestmentTxKind).
export type InvestmentTxKind =
  | "buy"
  | "sell"
  | "opening"
  | "dividend"
  | "coupon"
  | "interest"
  | "corporate_action";

export type InvestmentTxStatus = "active" | "void";

// EPIC-022 D2 — one buy or sell event, the real history a whole-record
// "edit" used to silently overwrite with no trace. `quantity`/`pricePerUnit`
// are this EVENT's own terms, never the holding's post-transaction state.
// `realizedPnl` is set only for a sell (null for every buy).
export interface InvestmentTransactionDto {
  id: string;
  investmentId: string;
  /** Legacy direction; null for income and corporate-action rows. Use `kind`. */
  type: InvestmentTxType | null;
  quantity: string;
  pricePerUnit: string;
  occurredAt: string;
  realizedPnl: string | null;
  createdAt: string;
  // ── Investasi rebuild (R5–R7) — optional so older fixtures type-check ──
  kind?: InvestmentTxKind;
  /** yyyy-mm-dd, the event's own date (not when it was recorded). */
  effectiveDate?: string;
  /** "HH:MM" only when known; null = date-only (sorted first that day). */
  effectiveTime?: string | null;
  timeZone?: string | null;
  grossAmount?: string;
  fee?: string;
  tax?: string;
  netAmount?: string;
  currency?: string;
  feeCurrency?: string | null;
  /** IDR per unit of `currency` at execution. */
  fxRate?: string | null;
  settlementDate?: string | null;
  cashAccountId?: string | null;
  cashTransactionId?: string | null;
  idempotencyKey?: string | null;
  status?: InvestmentTxStatus;
  voidedAt?: string | null;
  voidReason?: string | null;
  note?: string | null;
  updatedAt?: string;
}

export interface InvestmentSummaryDto {
  totalCostBasis: string;
  totalCurrentValue: string;
  totalReturnRp: string;
  totalReturnPct: number;
  todayReturnRp: string | null;
  todayReturnPct: number | null;
}

// EPIC-023 G1 (D15) — response shape for POST .../investments/:id/price
// (manual price entry). `source` is "manual" for user-entered prices,
// "yahoo-finance"/"coingecko"/"mock" for automated ones.
export interface InvestmentPriceDto {
  id: string;
  investmentId: string;
  price: string;
  source: string;
  asOf: string;
  delayed: boolean;
  recordedAt: string;
  // ── Investasi rebuild (spec §10) — optional so older fixtures type-check ──
  currency?: string;
  unitLabel?: string | null;
  reference?: string | null;
  /** False when only the date of `asOf` is known. */
  hasTime?: boolean;
}

/**
 * `InvestmentTransaction.note` of the synthetic `opening` the migration wrote
 * for a legacy holding whose stored quantity exceeded what its buy/sell
 * history explains. The UI shows it as "Dari data lama — lengkapi riwayat".
 */
export const LEGACY_RESIDUAL_NOTE = "legacy-residual";
