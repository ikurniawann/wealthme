import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import type { FxSnapshot } from "../fx/fx-snapshot";

const D = Prisma.Decimal;
type Decimal = Prisma.Decimal;

const IDR = "IDR";

/** Native amounts of a pocket top-up / withdrawal, as the user entered them. */
export interface PocketTransferAmountsInput {
  sourceAmount: string;
  sourceCurrency: string;
  destAmount?: string;
  destCurrency: string;
  fxRate?: string;
  fee?: string;
  feeCurrency?: string;
  /** yyyy-mm-dd of the transfer — the rate date of an actual rate. */
  rateDate: string;
}

/** One fx_conversions row describing a native amount and how it was valued. */
export interface PocketTransferConversion {
  field: "source" | "dest" | "fee";
  originalAmount: Decimal;
  originalCurrency: string;
  idrAmount: Decimal;
  idrPerUnit: Decimal;
  rateDate: string;
  /** "actual" = the rate the user entered; "identity" = IDR; else the snapshot source. */
  rateSource: string;
  rateStale: boolean;
}

export interface PocketTransferAmounts {
  /** IDR amount of the transfer row (debits source, credits destination). */
  amountIdr: bigint;
  /** IDR fee booked as a separate expense on the destination (0 = none). */
  feeIdr: bigint;
  sourceAmount: string;
  sourceCurrency: string;
  destAmount: string;
  destCurrency: string;
  fxRate: string | null;
  fee: string;
  feeCurrency: string;
  /** Empty when every amount is IDR (the transaction rows say it all). */
  conversions: PocketTransferConversion[];
}

function bad(message: string): never {
  throw new BadRequestException(message);
}

function toIdrInt(value: Decimal): bigint {
  return BigInt(value.toDecimalPlaces(0, D.ROUND_HALF_UP).toFixed(0));
}

function assertIdrWhole(value: Decimal, label: string, currency: string) {
  if (currency === IDR && !value.isInteger()) {
    bad(`${label} dalam IDR harus bilangan bulat (tanpa sen).`);
  }
}

/**
 * True when the amounts cannot be valued with the user's own numbers and a
 * market snapshot is needed: a same-currency foreign transfer (USD bank →
 * USD pocket) or a fee in a third currency.
 */
export function needsFxSnapshot(input: PocketTransferAmountsInput): boolean {
  const feeCurrency = input.feeCurrency ?? input.sourceCurrency;
  const hasFee = input.fee !== undefined && !new D(input.fee).isZero();
  if (input.sourceCurrency === input.destCurrency) {
    return input.sourceCurrency !== IDR || (hasFee && feeCurrency !== IDR);
  }
  const foreign =
    input.sourceCurrency === IDR ? input.destCurrency : input.sourceCurrency;
  return hasFee && feeCurrency !== IDR && feeCurrency !== foreign;
}

function snapshotRate(
  snapshot: FxSnapshot | null,
  currency: string,
): { rate: Decimal; source: string; date: string; stale: boolean } {
  const raw = snapshot
    ? (snapshot.idrPerUnit as Record<string, string>)[currency]
    : undefined;
  if (!snapshot || !raw) {
    bad(`Kurs ${currency} tidak tersedia.`);
  }
  return {
    rate: new D(raw),
    source: snapshot.source,
    date: snapshot.rateDate,
    stale: snapshot.stale,
  };
}

interface Valuation {
  rate: Decimal;
  source: string;
  date: string;
  stale: boolean;
}

function row(
  field: PocketTransferConversion["field"],
  amount: Decimal,
  currency: string,
  v: Valuation,
): PocketTransferConversion {
  return {
    field,
    originalAmount: amount,
    originalCurrency: currency,
    idrAmount: amount.mul(v.rate).toDecimalPlaces(2, D.ROUND_HALF_UP),
    idrPerUnit: v.rate,
    rateDate: v.date,
    rateSource: v.source,
    rateStale: v.stale,
  };
}

/**
 * Turns a top-up / withdrawal's native amounts into the IDR transfer amount
 * and IDR fee booked through the admin-fee pattern:
 *
 *   source −amountIdr, destination +amountIdr, destination −feeIdr
 *
 * so the destination nets `amountIdr − feeIdr` and net worth falls only by
 * the fee — a top-up is never income.
 *
 * - `sourceAmount` is the total that leaves the source; `destAmount` is the
 *   net that lands after the fee.
 * - Same currency: `destAmount` defaults to `sourceAmount − fee` (fee in the
 *   same currency) and must equal it when sent; `fxRate` is rejected.
 * - Cross currency: exactly one side must be IDR; `destAmount` and `fxRate`
 *   (IDR per 1 unit of the foreign currency, the ACTUAL rate) are required.
 *   An IDR source books `amountIdr = sourceAmount` (what really left the
 *   bank); a foreign source booked into an IDR account books
 *   `amountIdr = destAmount + feeIdr` so the bank lands on exactly the IDR it
 *   received.
 * - Foreign same-currency amounts and third-currency fees use the snapshot.
 */
export function computePocketTransferAmounts(
  input: PocketTransferAmountsInput,
  snapshot: FxSnapshot | null,
): PocketTransferAmounts {
  const src = new D(input.sourceAmount);
  if (src.lte(0)) bad("Jumlah transfer harus lebih dari nol.");
  const fee = new D(input.fee ?? "0");
  if (fee.isNegative()) bad("Biaya tidak boleh negatif.");
  const feeCurrency = input.feeCurrency ?? input.sourceCurrency;
  assertIdrWhole(src, "Jumlah sumber", input.sourceCurrency);
  assertIdrWhole(fee, "Biaya", feeCurrency);

  const identity: Valuation = {
    rate: new D(1),
    source: "identity",
    date: input.rateDate,
    stale: false,
  };
  const sameCurrency = input.sourceCurrency === input.destCurrency;

  let dest: Decimal;
  let fxRate: Decimal | null = null;
  let srcVal: Valuation;
  let destVal: Valuation;

  if (sameCurrency) {
    if (input.fxRate !== undefined) {
      bad("fxRate hanya diisi untuk transfer lintas mata uang.");
    }
    const expected = feeCurrency === input.sourceCurrency ? src.sub(fee) : src;
    if (expected.lte(0)) bad("Biaya tidak boleh melebihi jumlah transfer.");
    if (
      input.destAmount !== undefined &&
      !new D(input.destAmount).eq(expected)
    ) {
      bad("Jumlah diterima harus sama dengan jumlah dikirim dikurangi biaya.");
    }
    dest = expected;
    srcVal =
      input.sourceCurrency === IDR
        ? identity
        : snapshotRate(snapshot, input.sourceCurrency);
    destVal = srcVal;
  } else {
    if (input.sourceCurrency !== IDR && input.destCurrency !== IDR) {
      bad(
        "Transfer antar dua mata uang asing belum didukung. Catat lewat rekening IDR.",
      );
    }
    if (input.destAmount === undefined || input.fxRate === undefined) {
      bad(
        "Transfer lintas mata uang wajib mengisi jumlah diterima dan kurs aktual.",
      );
    }
    dest = new D(input.destAmount);
    fxRate = new D(input.fxRate);
    if (dest.lte(0)) bad("Jumlah diterima harus lebih dari nol.");
    if (fxRate.lte(0)) bad("Kurs harus lebih dari nol.");
    assertIdrWhole(dest, "Jumlah diterima", input.destCurrency);
    const actual: Valuation = {
      rate: fxRate,
      source: "actual",
      date: input.rateDate,
      stale: false,
    };
    srcVal = input.sourceCurrency === IDR ? identity : actual;
    destVal = input.destCurrency === IDR ? identity : actual;
  }

  let feeVal: Valuation;
  if (feeCurrency === IDR) feeVal = identity;
  else if (feeCurrency === input.sourceCurrency) feeVal = srcVal;
  else if (feeCurrency === input.destCurrency) feeVal = destVal;
  else feeVal = snapshotRate(snapshot, feeCurrency);
  const feeIdr = fee.isZero() ? BigInt(0) : toIdrInt(fee.mul(feeVal.rate));

  let amountIdr: bigint;
  if (sameCurrency || input.sourceCurrency === IDR) {
    amountIdr = toIdrInt(src.mul(srcVal.rate));
  } else {
    // Foreign source into an IDR account: the IDR that landed is exact.
    amountIdr = toIdrInt(dest) + feeIdr;
  }
  if (amountIdr - feeIdr <= BigInt(0)) {
    bad("Biaya tidak boleh melebihi jumlah transfer.");
  }

  const anyForeign =
    input.sourceCurrency !== IDR ||
    input.destCurrency !== IDR ||
    (!fee.isZero() && feeCurrency !== IDR);
  const conversions: PocketTransferConversion[] = anyForeign
    ? [
        row("source", src, input.sourceCurrency, srcVal),
        row("dest", dest, input.destCurrency, destVal),
        ...(fee.isZero() ? [] : [row("fee", fee, feeCurrency, feeVal)]),
      ]
    : [];

  return {
    amountIdr,
    feeIdr,
    sourceAmount: src.toString(),
    sourceCurrency: input.sourceCurrency,
    destAmount: dest.toString(),
    destCurrency: input.destCurrency,
    fxRate: fxRate ? fxRate.toString() : null,
    fee: fee.toString(),
    feeCurrency,
    conversions,
  };
}
