import type {
  AssetHistoryEventDto,
  AssetHoldingStateDto,
  AssetLedgerDto,
} from "@wealthme/contracts";
import type { AsetDetailCopy } from "@/i18n/aset-detail";
import { roundIdr } from "../aset-model";

/**
 * Pure helpers for the asset detail page. Money and quantities arrive as
 * decimal strings; every figure here is derived with BigInt fixed point
 * (8 dp), never floats, so billions–trillions stay exact. The API stays
 * authoritative: these only display what the ledger already stores.
 */

const SCALE = BigInt(100000000);
const ZERO = BigInt(0);

/** Decimal string → fixed-point bigint (8 dp, extra digits truncated). */
export function fixed(value: string): bigint {
  const v = value.trim();
  const negative = v.startsWith("-");
  const [whole = "0", frac = ""] = v.replace(/^[-+]/, "").split(".");
  const n = BigInt(`${whole || "0"}${frac.slice(0, 8).padEnd(8, "0")}`);
  return negative ? -n : n;
}

/** Fixed-point bigint → plain decimal string (trailing zeros dropped). */
export function plain(value: bigint): string {
  const negative = value < ZERO;
  const n = negative ? -value : value;
  const frac = (n % SCALE).toString().padStart(8, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${n / SCALE}${frac ? `.${frac}` : ""}`;
}

export function mul(a: string, b: string): string {
  return plain((fixed(a) * fixed(b)) / SCALE);
}

export function sub(a: string, b: string): string {
  return plain(fixed(a) - fixed(b));
}

/** diff ÷ base × 100, 2 dp; null when the base is ≤ 0 (never Infinity). */
export function pct(diff: string, base: string): number | null {
  const b = fixed(base);
  if (b <= ZERO) return null;
  return Number((fixed(diff) * BigInt(10000)) / b) / 100;
}

export function isPositive(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    return fixed(value) > ZERO;
  } catch {
    return false;
  }
}

const VALUE_KINDS = new Set(["opening", "valuation", "correction"]);

/** Newest active row that set a value (opening / valuation / correction). */
export function latestValuation(
  events: AssetHistoryEventDto[],
): AssetHistoryEventDto | null {
  return (
    events.find((e) => e.status === "active" && VALUE_KINDS.has(e.kind)) ?? null
  );
}

export interface PriceNow {
  /** Price per unit, in `currency`. */
  value: string;
  currency: string;
  /** True when derived as value ÷ quantity (no stored per-unit price). */
  derived: boolean;
}

/** Current price per unit for a per-unit asset (never a trade price). */
export function currentPrice(ledger: AssetLedgerDto): PriceNow | null {
  const state = ledger.asset;
  if (state.valuationModel !== "per_unit") return null;
  const last = latestValuation(ledger.events);
  if (last?.pricePerUnit)
    return {
      value: last.pricePerUnit,
      currency: last.currency,
      derived: false,
    };
  if (!isPositive(state.quantity)) return null;
  return {
    value: plain(
      (fixed(state.currentValueIdr) * SCALE) / fixed(state.quantity!),
    ),
    currency: "IDR",
    derived: true,
  };
}

/** Remaining cost basis (IDR) = weighted-average cost × quantity. */
export function costTotal(state: AssetHoldingStateDto): string | null {
  if (!state.costBasisKnown || !state.costBasisPerUnit || !state.quantity)
    return null;
  return mul(state.costBasisPerUnit, state.quantity);
}

export interface Pnl {
  amount: string;
  percent: number | null;
}

/** Unrealized = value − remaining cost; % of cost when cost > 0. */
export function unrealized(state: AssetHoldingStateDto): Pnl | null {
  const cost = costTotal(state);
  if (cost === null) return null;
  const amount = sub(state.currentValueIdr, cost);
  return { amount, percent: pct(amount, cost) };
}

function intl(locale: string): string {
  return locale === "en" ? "en-US" : "id-ID";
}

/** yyyy-mm-dd calendar date → "19 Okt 2026" (never shifted by a zone). */
export function fmtDay(ymd: string, locale: string): string {
  const d = new Date(`${ymd.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return ymd;
  return new Intl.DateTimeFormat(intl(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** Clock time of a timed event in its own zone, e.g. "14.30 WIB". */
export function fmtClock(
  ev: Pick<AssetHistoryEventDto, "effectiveAt" | "timeZone">,
  locale: string,
): string {
  const zone = ev.timeZone || "Asia/Jakarta";
  try {
    return new Intl.DateTimeFormat(intl(locale), {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: zone,
      timeZoneName: "short",
    }).format(new Date(ev.effectiveAt));
  } catch {
    return "";
  }
}

/** "19 Okt 2026 14.30 (Asia/Jakarta)" or "19 Okt 2026 (tanggal saja)". */
export function fmtWhenLong(
  ev: AssetHistoryEventDto,
  locale: string,
  d: AsetDetailCopy,
): string {
  const day = fmtDay(ev.effectiveDate, locale);
  if (!ev.hasTime) return `${day} (${d.dateOnly})`;
  const zone = ev.timeZone || "Asia/Jakarta";
  const time = fmtClock(ev, locale).replace(/\s+\S+$/, "");
  return `${day} ${time} (${zone})`;
}

/** Known source keys → label; anything typed by hand is shown as typed. */
export function sourceLabel(source: string, d: AsetDetailCopy): string {
  const key = source.trim().toLowerCase();
  return key in d.sources ? d.sources[key as keyof typeof d.sources] : source;
}

/** Quantity with locale grouping; up to 8 decimals, never rounded to 0. */
export function fmtQty(q: string | null, locale: string): string {
  if (q == null) return "—";
  const [whole = "0", frac = ""] = q.replace("-", "").split(".");
  const grouped = new Intl.NumberFormat(intl(locale)).format(BigInt(whole));
  const f = frac.replace(/0+$/, "");
  const sep = locale === "en" ? "." : ",";
  return `${q.startsWith("-") ? "−" : ""}${grouped}${f ? `${sep}${f}` : ""}`;
}

export function withUnit(
  q: string | null,
  unit: string | null,
  locale: string,
) {
  if (q == null) return "—";
  return unit ? `${fmtQty(q, locale)} ${unit}` : fmtQty(q, locale);
}

/** Signed percentage "+10%", "−9,09%"; "—" when unknown. */
export function fmtPctSigned(p: number | null, locale: string): string {
  if (p === null || !Number.isFinite(p)) return "—";
  const body = new Intl.NumberFormat(intl(locale), {
    maximumFractionDigits: 2,
  }).format(Math.abs(p));
  return `${p > 0 ? "+" : p < 0 ? "−" : ""}${body}%`;
}

export type Tone = "up" | "down" | "flat";

export function toneOf(value: string | null | undefined): Tone {
  if (!value) return "flat";
  const n = fixed(value);
  return n > ZERO ? "up" : n < ZERO ? "down" : "flat";
}

/** IDR decimal → whole rupiah bigint (half-up). */
export function idr(value: string): bigint {
  return roundIdr(value);
}

/** "+Rp 1.000.000" / "−Rp 1.000.000" / "Rp 0" from a formatter of |n|. */
export function signedIdr(
  value: string,
  format: (n: bigint) => string,
): string {
  const n = idr(value);
  const abs = n < ZERO ? -n : n;
  const sign = n > ZERO ? "+" : n < ZERO ? "−" : "";
  return `${sign}${format(abs)}`;
}

/** Money in an event currency: IDR exact; others with 2 decimals. */
export function fmtCurrency(
  value: string,
  currency: string,
  locale: string,
  formatIdr: (n: bigint) => string,
): string {
  if (currency === "IDR") return formatIdr(idr(value));
  return new Intl.NumberFormat(intl(locale), {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

/** Today in Asia/Jakarta, yyyy-mm-dd. */
export function jakartaToday(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta" }).format(
    new Date(),
  );
}

/** Canonical decimal from typed input ("1.100.000" / "1.100.000,5"). */
export function typedToDecimal(typed: string): string {
  const cleaned = typed.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  return /^\d+(\.\d+)?$/.test(cleaned) ? cleaned.replace(/^0+(?=\d)/, "") : "";
}

/** Live grouping while typing: "1100000,5" → "1.100.000,5". */
export function groupTyping(raw: string, decimals = 8): string {
  const cleaned = raw.replace(/[^\d,]/g, "");
  const [whole = "", ...rest] = cleaned.split(",");
  const w = whole.replace(/^0+(?=\d)/, "");
  const grouped = w ? new Intl.NumberFormat("id-ID").format(BigInt(w)) : "";
  if (rest.length === 0) return grouped;
  return `${grouped || "0"},${rest.join("").slice(0, decimals)}`;
}
