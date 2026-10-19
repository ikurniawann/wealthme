import type { InvestmentMarket } from "./markets.js";
import type { PocketKind } from "./platforms.js";

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
  /** Catalog name, or `customName` for "custom" (falls back to the key). */
  platformName?: string;
  /** Owner display name (null = family-shared). */
  ownerName?: string | null;
  /** Cash pockets the viewer may see (Accounts of type `investment`). */
  pockets?: PlatformPocketDto[];
  /** Holdings (Investment rows) linked to this platform account. */
  holdingsCount?: number;
}

/**
 * Investasi R2/R9 — a cash pocket ("kantong dana") at a platform account. It
 * IS an `Account` of type `investment` (id = account id), so its balance is
 * the IDR book balance and it is counted once in net worth via the accounts
 * sum. All money fields are IDR integers serialized as strings.
 */
export interface PlatformPocketDto {
  id: string;
  name: string;
  pocketKind: PocketKind;
  /** Native currency of the pocket (IDR, USD, ...). The balance is IDR. */
  currency: string;
  ownerUserId: string | null;
  isPrivate: boolean;
  status: string;
  /**
   * Kas tercatat — Account.balance (IDR). The three balances are null with
   * `balancesHidden: true` when the viewer's "Lihat saldo" is off and the
   * pocket is not theirs.
   */
  recordedBalance: string | null;
  /** Dana tertahan — sell proceeds with settlementDate > today (R9), IDR. */
  heldBalance: string | null;
  /** Dana tersedia = recorded − held. */
  availableBalance: string | null;
  balancesHidden?: boolean;
  /**
   * True when some unsettled foreign proceeds carry no fxRate and could not
   * be valued in IDR (then `heldBalance` understates what is held).
   */
  heldIncomplete: boolean;
  /** Holdings funded from this pocket. */
  holdingsCount: number;
}

/** Body of POST …/platform-accounts/:id/pockets (and `pockets[]` on create). */
export interface CreatePlatformPocketInput {
  pocketKind: PocketKind;
  /** ISO 4217; defaults to "USD" for a usd pocket, else "IDR". */
  currency?: string;
  /** Display name; default "<platform> · <kind label>". */
  name?: string;
  /** Opening balance, IDR integer (send `fxInputs` for a foreign amount). */
  balance?: number;
  isPrivate?: boolean;
}

export interface CreatePlatformAccountInput {
  platformKey: string;
  /** Required when platformKey = "custom". */
  customName?: string;
  ownerUserId?: string;
  label?: string;
  accountRef?: string;
  pockets?: CreatePlatformPocketInput[];
}

export interface UpdatePlatformAccountInput {
  customName?: string | null;
  label?: string | null;
  accountRef?: string | null;
  ownerUserId?: string | null;
}

/**
 * Body of POST …/pockets/:pocketId/top-up (bank → pocket) and /withdraw
 * (pocket → bank). Amounts are canonical decimal strings in their own
 * currency ("1500000", "100.25").
 * - `sourceAmount`: total that leaves the source account.
 * - `destAmount`: net that lands in the destination after `fee`.
 * - `fxRate`: the actual rate used. When exactly one side is IDR it is IDR
 *   per 1 unit of the foreign currency; when both sides are foreign it is
 *   destCurrency per 1 sourceCurrency. Omit for same-currency transfers.
 * - `fee` (in `feeCurrency`, default sourceCurrency) is booked as a separate
 *   expense on the destination (the admin-fee pattern); it is never income.
 */
export interface PocketTransferInput {
  /** The bank/e-wallet/cash account on the other side. */
  counterAccountId: string;
  sourceAmount: string;
  sourceCurrency: string;
  destAmount?: string;
  destCurrency: string;
  fxRate?: string;
  fee?: string;
  feeCurrency?: string;
  occurredAt: string;
  description?: string;
  /** uuid generated when the form opens (R7). */
  idempotencyKey: string;
}

export interface PocketTransferResultDto {
  /** True when the idempotencyKey was already used: nothing new was written. */
  replayed: boolean;
  /** The transfer Transaction id (type transfer, accountId → toAccountId). */
  transactionId: string;
  /** The linked fee expense Transaction id, or null when there was no fee. */
  feeTransactionId: string | null;
  /** IDR moved by the transfer row (debited from the source). */
  amountIdr: string;
  /** IDR fee expense booked on the destination. */
  feeIdr: string;
  /** Native amounts + actual rate (also stored in fx_conversions). */
  sourceAmount: string;
  sourceCurrency: string;
  destAmount: string;
  destCurrency: string;
  fxRate: string | null;
  fee: string;
  feeCurrency: string;
  pocket: PlatformPocketDto;
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
