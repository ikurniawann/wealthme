import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { MARKETS } from "@wealthme/contracts";

import {
  addDaysYmd,
  isValidTimeZone,
  isValidYmd,
  LEDGER_DEFAULT_TIME_ZONE,
} from "./ledger-dates";
import { INCOME_KINDS, rowNetAmount } from "./replay";

import type { LedgerKind } from "./replay";
import type { InvestmentMarket } from "@wealthme/contracts";

const D = Prisma.Decimal;
type Decimal = Prisma.Decimal;
const ZERO = new D(0);
/** Decimal(24,8) / Decimal(18,8) column scale. */
const SCALE = 8;
const MAX_QUANTITY_DECIMALS = 8;

/** Raw, string-typed ledger input (create body, or an edit merged onto a row). */
export interface RawLedgerInput {
  kind: LedgerKind;
  effectiveDate: string;
  effectiveTime?: string | null;
  timeZone?: string | null;
  quantity?: string;
  pricePerUnit?: string;
  grossAmount?: string;
  fee?: string;
  tax?: string;
  currency: string;
  feeCurrency?: string | null;
  fxRate?: string | null;
  /** undefined → market default (sell only); null → none. */
  settlementDate?: string | null;
  /** undefined → the holding's default; null → no cash leg. */
  cashAccountId?: string | null;
  note?: string | null;
}

/** A validated ledger row ready to replay and persist. */
export interface ProposedRow {
  kind: LedgerKind;
  quantity: Decimal;
  pricePerUnit: Decimal;
  grossAmount: Decimal;
  fee: Decimal;
  tax: Decimal;
  netAmount: Decimal;
  currency: string;
  feeCurrency: string | null;
  fxRate: Decimal | null;
  effectiveDate: string;
  effectiveTime: string | null;
  timeZone: string | null;
  settlementDate: string | null;
  cashAccountId: string | null;
  note: string | null;
}

export interface LedgerHoldingConfig {
  market: InvestmentMarket | null;
  allowFraction: boolean | null;
  cashAccountId: string | null;
}

function bad(message: string): never {
  throw new BadRequestException(message);
}

function dec(value: string | undefined, field: string): Decimal | undefined {
  if (value === undefined) return undefined;
  try {
    return new D(value);
  } catch {
    return bad(`${field} bukan angka yang valid`);
  }
}

function assertQuantityShape(q: Decimal, holding: LedgerHoldingConfig): void {
  const market = holding.market ? MARKETS[holding.market] : null;
  const allowFraction =
    holding.allowFraction ?? market?.allowFractionDefault ?? true;
  if (!allowFraction && !q.isInteger()) {
    bad(
      "Kuantitas harus bilangan bulat untuk instrumen ini (pecahan tidak didukung platform/pasar)",
    );
  }
  const maxDecimals =
    allowFraction && market ? market.quantityDecimals : MAX_QUANTITY_DECIMALS;
  if (q.decimalPlaces() > maxDecimals) {
    bad(
      `Kuantitas maksimal ${maxDecimals} angka di belakang koma untuk pasar ini`,
    );
  }
}

function defaultSettlement(
  kind: LedgerKind,
  tradeDate: string,
  holding: LedgerHoldingConfig,
): string | null {
  if (kind !== "sell" || !holding.market) return null;
  const m = MARKETS[holding.market];
  // R9 — T+0 markets (crypto, mutual funds) settle on the trade date: no
  // held proceeds unless the user enters a later date.
  if (m.settlementDays === null || m.settlementDays <= 0) return null;
  return addDaysYmd(tradeDate, m.settlementDays, m.settlementBusinessDays);
}

/**
 * Validates one ledger event against its kind and the holding's market
 * config. Quantity is base units (R4): lots are display-only, so no lot
 * multiple is enforced; fractional quantity is rejected where the holding
 * does not allow fractions. Execution price is always the recorded one.
 */
export function normalizeLedgerInput(
  raw: RawLedgerInput,
  holding: LedgerHoldingConfig,
  todayYmd: string,
): ProposedRow {
  const kind = raw.kind;
  const isIncome = INCOME_KINDS.includes(kind);

  if (!isValidYmd(raw.effectiveDate)) bad("Tanggal efektif tidak valid");
  if (raw.effectiveDate > todayYmd) {
    bad("Tanggal efektif tidak boleh di masa depan");
  }
  const effectiveTime = raw.effectiveTime ?? null;
  let timeZone = raw.timeZone ?? null;
  if (timeZone !== null && !isValidTimeZone(timeZone)) {
    bad("Zona waktu tidak dikenal");
  }
  if (effectiveTime !== null && timeZone === null) {
    timeZone = LEDGER_DEFAULT_TIME_ZONE;
  }

  const quantityIn = dec(raw.quantity, "quantity");
  const priceIn = dec(raw.pricePerUnit, "pricePerUnit");
  const grossIn = dec(raw.grossAmount, "grossAmount");
  const fee = dec(raw.fee, "fee") ?? ZERO;
  const tax = dec(raw.tax, "tax") ?? ZERO;
  if (fee.lessThan(0) || tax.lessThan(0)) {
    bad("Biaya dan pajak tidak boleh negatif");
  }

  let quantity = ZERO;
  let pricePerUnit = ZERO;
  let grossAmount = ZERO;

  if (kind === "buy" || kind === "sell" || kind === "opening") {
    if (!quantityIn || !quantityIn.greaterThan(0)) {
      bad("Kuantitas harus lebih dari 0");
    }
    if (!priceIn || priceIn.lessThan(0)) {
      bad("Harga per unit wajib diisi dan tidak boleh negatif");
    }
    quantity = quantityIn;
    pricePerUnit = priceIn;
    assertQuantityShape(quantity, holding);
    const computed = quantity
      .times(pricePerUnit)
      .toDecimalPlaces(SCALE, D.ROUND_HALF_UP);
    grossAmount = kind === "opening" ? computed : (grossIn ?? computed);
    if (grossAmount.lessThan(0)) bad("Nilai transaksi tidak boleh negatif");
  } else if (isIncome) {
    if (quantityIn && !quantityIn.isZero()) {
      bad("Dividen/kupon/bunga tidak mengubah kuantitas");
    }
    if (!grossIn || !grossIn.greaterThan(0)) {
      bad("Jumlah dividen/kupon/bunga harus lebih dari 0");
    }
    grossAmount = grossIn;
  } else {
    // corporate_action — signed unit change, no cash, cost carried over.
    if (!quantityIn || quantityIn.isZero()) {
      bad("Aksi korporasi harus mengubah kuantitas (positif atau negatif)");
    }
    quantity = quantityIn;
    assertQuantityShape(quantity.abs(), holding);
    if (!fee.isZero() || !tax.isZero() || (grossIn && !grossIn.isZero())) {
      bad("Aksi korporasi tidak memiliki nilai, biaya, atau pajak");
    }
  }

  const netAmount = rowNetAmount({ kind, grossAmount, fee, tax });
  if (netAmount.lessThan(0)) {
    bad("Biaya dan pajak melebihi nilai transaksi");
  }

  const currency = raw.currency;
  const feeCurrency = raw.feeCurrency ?? null;
  if (feeCurrency !== null && feeCurrency !== currency) {
    bad(
      "Biaya dalam mata uang lain belum didukung; catat biaya dalam mata uang transaksi",
    );
  }
  let fxRate: Decimal | null = null;
  if (currency === "IDR") {
    if (raw.fxRate !== undefined && raw.fxRate !== null) {
      const r = dec(raw.fxRate, "fxRate");
      if (r && !r.equals(1))
        bad("fxRate hanya untuk transaksi mata uang asing");
    }
  } else {
    fxRate = dec(raw.fxRate ?? undefined, "fxRate") ?? null;
    if (!fxRate || !fxRate.greaterThan(0)) {
      bad(`Kurs aktual (IDR per 1 ${currency}) wajib diisi`);
    }
  }

  let settlementDate: string | null;
  if (raw.settlementDate === undefined) {
    settlementDate = defaultSettlement(kind, raw.effectiveDate, holding);
  } else {
    settlementDate = raw.settlementDate;
    if (settlementDate !== null) {
      if (kind !== "sell") {
        bad("Tanggal penyelesaian hanya untuk transaksi jual");
      }
      if (!isValidYmd(settlementDate)) bad("Tanggal penyelesaian tidak valid");
      if (settlementDate < raw.effectiveDate) {
        bad("Tanggal penyelesaian tidak boleh sebelum tanggal transaksi");
      }
    }
  }

  let cashAccountId: string | null;
  if (kind === "opening" || kind === "corporate_action") {
    if (raw.cashAccountId) {
      bad(
        kind === "opening"
          ? "Kepemilikan awal tidak memotong kantong dana"
          : "Aksi korporasi tidak menggerakkan dana",
      );
    }
    cashAccountId = null;
  } else {
    cashAccountId =
      raw.cashAccountId === undefined
        ? holding.cashAccountId
        : raw.cashAccountId;
    if (isIncome && !cashAccountId) {
      bad("Pilih kantong dana yang menerima dividen/kupon/bunga");
    }
  }

  return {
    kind,
    quantity,
    pricePerUnit,
    grossAmount,
    fee,
    tax,
    netAmount,
    currency,
    feeCurrency,
    fxRate,
    effectiveDate: raw.effectiveDate,
    effectiveTime,
    timeZone,
    settlementDate,
    cashAccountId,
    note: raw.note ?? null,
  };
}
