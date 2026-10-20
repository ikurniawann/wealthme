import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { FX_CURRENCY_CODES } from "@wealthme/contracts";

import {
  isValidTimeZone,
  isValidYmd,
  jakartaTodayYmd,
  ledgerInstant,
  LEDGER_DEFAULT_TIME_ZONE,
  ymdToDbDate,
} from "../../investments/ledger/ledger-dates";

import { toRupiah } from "./asset-timeline";

import type { AssetHistory, AssetValuationModel } from "@prisma/client";
import type { AssetValuationInput } from "@wealthme/contracts";

/**
 * Aset §11 — validates an Update Nilai request. A value update never moves
 * cash or cost: it only states what the asset is worth at a point in time.
 *  - per_unit: `pricePerUnit` (in `currency`), value = quantity × price
 *  - total: `value` (in `currency`) for the whole asset
 * Date-only entries are stored date-only (effectiveAt 00:00 UTC of the
 * date, hasTime=false); no clock time is invented. A time is read in
 * `timeZone` (Asia/Jakarta when omitted).
 */

const D = Prisma.Decimal;
type Decimal = Prisma.Decimal;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_DECIMALS = 8;
/** Decimal(24,8): 16 integer digits. */
const MAX_INTEGER_DIGITS = 16;

export interface NormalizedValuation {
  effectiveAt: Date;
  effectiveDate: Date;
  effectiveYmd: string;
  hasTime: boolean;
  timeZone: string | null;
  pricePerUnit: Decimal | null;
  /** Total in `currency` (total model). */
  amount: Decimal | null;
  currency: string;
  fxRate: Decimal | null;
  source: string;
  reference: string | null;
  note: string | null;
}

function bad(message: string): never {
  throw new BadRequestException(message);
}

function money(v: string | undefined, field: string): Decimal | null {
  if (v === undefined || v === null || v === "") return null;
  let d: Decimal;
  try {
    d = new D(v);
  } catch {
    return bad(`${field} bukan angka yang valid`);
  }
  if (!d.isFinite() || d.lessThan(0)) bad(`${field} tidak boleh negatif`);
  if (d.decimalPlaces() > MAX_DECIMALS) {
    bad(`${field} maksimal ${MAX_DECIMALS} angka di belakang koma`);
  }
  if (d.trunc().toFixed(0).length > MAX_INTEGER_DIGITS)
    bad(`${field} terlalu besar`);
  return d;
}

export function normalizeValuation(
  input: AssetValuationInput,
  model: AssetValuationModel | null,
  now: Date = new Date(),
): NormalizedValuation {
  const today = jakartaTodayYmd(now);
  if (!isValidYmd(input.effectiveDate)) bad("Tanggal efektif tidak valid");
  if (input.effectiveDate > today)
    bad("Tanggal efektif tidak boleh di masa depan");
  const time = input.effectiveTime ?? null;
  if (time !== null && !TIME_RE.test(time)) bad("Jam harus berformat HH:MM");
  let timeZone = input.timeZone ?? null;
  if (timeZone !== null && !isValidTimeZone(timeZone))
    bad("Zona waktu tidak dikenal");
  if (time !== null && timeZone === null) timeZone = LEDGER_DEFAULT_TIME_ZONE;
  const effectiveAt = time
    ? ledgerInstant(input.effectiveDate, time, timeZone)
    : ymdToDbDate(input.effectiveDate);
  if (time && effectiveAt.getTime() > now.getTime() + 60_000) {
    bad("Waktu efektif tidak boleh di masa depan");
  }

  const pricePerUnit = money(input.pricePerUnit, "Harga per unit");
  const amount = money(input.value, "Nilai");
  if ((pricePerUnit === null) === (amount === null)) {
    bad("Isi salah satu: harga per unit atau nilai total");
  }
  if (model === "per_unit" && pricePerUnit === null) {
    bad("Aset ini dinilai per unit: isi harga per unit");
  }
  if (model === "total" && amount === null) {
    bad("Aset ini dinilai sebagai satu kesatuan: isi nilai total");
  }

  const currency = input.currency;
  if (!(FX_CURRENCY_CODES as readonly string[]).includes(currency)) {
    bad("Mata uang tidak didukung");
  }
  let fxRate: Decimal | null = null;
  if (currency === "IDR") {
    const r = money(input.fxRate ?? undefined, "Kurs");
    if (r && !r.equals(1)) bad("Kurs hanya untuk mata uang asing");
  } else {
    fxRate = money(input.fxRate ?? undefined, "Kurs");
    if (!fxRate || !fxRate.greaterThan(0)) {
      bad(`Kurs aktual (IDR per 1 ${currency}) wajib diisi`);
    }
  }
  const source = (input.source ?? "").trim();
  if (!source) bad("Sumber valuasi wajib diisi");
  return {
    effectiveAt,
    effectiveDate: ymdToDbDate(input.effectiveDate),
    effectiveYmd: input.effectiveDate,
    hasTime: time !== null,
    timeZone,
    pricePerUnit,
    amount,
    currency,
    fxRate,
    source,
    reference: input.reference?.trim() || null,
    note: input.note?.trim() || null,
  };
}

/** IDR value of a total valuation (whole rupiah, half-up). */
export function totalIdr(v: NormalizedValuation): bigint | null {
  if (v.amount === null) return null;
  return toRupiah(v.currency === "IDR" ? v.amount : v.amount.times(v.fxRate!));
}

/** HH:MM of an instant in `tz` (for edits that keep a row's time). */
export function timeInZone(at: Date, tz: string | null): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz ?? LEDGER_DEFAULT_TIME_ZONE,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("hour")}:${get("minute")}`;
}

/** The stored row as a request, so an edit can merge onto it. */
export function rowAsInput(h: AssetHistory): AssetValuationInput {
  const total =
    h.pricePerUnit === null
      ? h.currency === "IDR" || !h.fxRate
        ? h.value.toString()
        : new D(h.value.toString())
            .dividedBy(h.fxRate)
            .toDecimalPlaces(MAX_DECIMALS)
            .toString()
      : undefined;
  return {
    pricePerUnit: h.pricePerUnit?.toString(),
    value: total,
    currency: h.currency,
    fxRate: h.fxRate?.toString() ?? null,
    effectiveDate: h.effectiveDate.toISOString().slice(0, 10),
    effectiveTime: h.hasTime ? timeInZone(h.effectiveAt, h.timeZone) : null,
    timeZone: h.timeZone,
    source: h.source,
    reference: h.reference,
    note: h.note,
  };
}

/** R7 — the payload fields a retried Update Nilai must repeat exactly. */
export function sameValuation(
  a: NormalizedValuation,
  b: NormalizedValuation,
): boolean {
  const eq = (x: Decimal | null, y: Decimal | null) =>
    x === null ? y === null : y !== null && x.equals(y);
  return (
    a.effectiveAt.getTime() === b.effectiveAt.getTime() &&
    a.hasTime === b.hasTime &&
    a.effectiveYmd === b.effectiveYmd &&
    a.timeZone === b.timeZone &&
    eq(a.pricePerUnit, b.pricePerUnit) &&
    eq(a.amount, b.amount) &&
    a.currency === b.currency &&
    eq(a.fxRate, b.fxRate) &&
    a.source === b.source &&
    a.reference === b.reference &&
    a.note === b.note
  );
}
