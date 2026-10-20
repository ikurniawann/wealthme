import {
  bankCountry,
  daysBetween,
  estimateNetInterest,
  nextMaturityDate,
  type AccountDto,
  type BankProductKind,
  type FxRatesResponse,
} from "@wealthme/contracts";

import { findKnownBank, type KnownBank } from "./bank-directory";

/**
 * Rekening v3 — pure view model for /rekening: one row per account, plus
 * the figures the page derives from them (composition, deposit-insurance
 * exposure, liquidity, interest, attention items, filters, grouping). Kept
 * free of React so every number the page shows is unit-tested here.
 */

/** Days without a transaction before an account is flagged as drifting dormant. */
export const IDLE_DAYS_WARNING = 90;
/** How far ahead a deposit maturity is surfaced in "Perlu perhatian". */
export const MATURITY_WARNING_DAYS = 30;
/** Share of the insurance cap at which an exposure starts to be flagged. */
export const INSURANCE_NEAR_RATIO = 0.9;

export interface RekeningRow {
  account: AccountDto;
  /** IDR balance; null when the viewer's "Lihat saldo" is off. */
  balance: number | null;
  bank: KnownBank | null;
  bankName: string;
  /** Groups the same bank in the same country. */
  bankKey: string;
  holderLabel: string;
  holderKey: string;
  kind: BankProductKind;
  country: string;
  maturity: string | null;
  daysToMaturity: number | null;
  /** Days since the last transaction (or since creation when none). */
  idleDays: number;
}

export interface RowLabels {
  family: string;
}

export function toRows(
  accounts: readonly AccountDto[],
  today: string,
  labels: RowLabels,
): RekeningRow[] {
  return accounts.map((account) => {
    const bank = findKnownBank(account.institution);
    const bankName = account.institution || account.name;
    const country = account.country ?? "ID";
    const holderLabel =
      account.holderName || account.ownerName || labels.family;
    const holderKey =
      account.holderUserId ??
      (account.holderName
        ? `name:${account.holderName.trim().toLowerCase()}`
        : (account.ownerUserId ?? "family"));
    const kind = account.productKind ?? "savings";
    const maturity =
      kind === "time_deposit"
        ? nextMaturityDate(
            account.placementDate,
            account.tenorMonths,
            account.maturityInstruction,
            today,
          )
        : null;
    const lastSeen = account.lastActivityAt ?? account.createdAt.slice(0, 10);
    return {
      account,
      balance: account.balance === null ? null : Number(account.balance),
      bank,
      bankName: bank?.name ?? bankName,
      bankKey: `${country}:${(bank?.name ?? bankName).trim().toLowerCase()}`,
      holderLabel,
      holderKey,
      kind,
      country,
      maturity,
      daysToMaturity: maturity ? daysBetween(today, maturity) : null,
      idleDays: Math.max(0, daysBetween(lastSeen, today)),
    };
  });
}

// ── Composition ─────────────────────────────────────────────────────────────

export type CompositionAxis = "bank" | "kind" | "holder";

export interface Slice {
  key: string;
  label: string;
  amount: number;
  /** Whole percent; the slices always add up to exactly 100. */
  percent: number;
  count: number;
}

/**
 * Balance by bank / product kind / holder. Past `maxSlices` the tail folds
 * into one "other" slice, so the bar and its legend stay readable however
 * many accounts the family has. Percentages use largest-remainder rounding
 * so they sum to 100.
 */
export function composition(
  rows: readonly RekeningRow[],
  axis: CompositionAxis,
  labelFor: (row: RekeningRow) => string,
  otherLabel: string,
  maxSlices = 5,
): Slice[] {
  const map = new Map<string, Slice>();
  for (const row of rows) {
    if (row.balance === null || row.balance <= 0) continue;
    const key =
      axis === "bank"
        ? row.bankKey
        : axis === "kind"
          ? row.kind
          : row.holderKey;
    const slice = map.get(key) ?? {
      key,
      label: labelFor(row),
      amount: 0,
      percent: 0,
      count: 0,
    };
    slice.amount += row.balance;
    slice.count += 1;
    map.set(key, slice);
  }
  let slices = [...map.values()].sort((a, b) => b.amount - a.amount);
  if (slices.length > maxSlices) {
    const head = slices.slice(0, maxSlices - 1);
    const tail = slices.slice(maxSlices - 1);
    slices = [
      ...head,
      {
        key: "__other",
        label: otherLabel,
        amount: tail.reduce((s, x) => s + x.amount, 0),
        percent: 0,
        count: tail.reduce((s, x) => s + x.count, 0),
      },
    ];
  }
  return withPercents(slices);
}

function withPercents(slices: Slice[]): Slice[] {
  const total = slices.reduce((s, x) => s + x.amount, 0);
  if (total <= 0) return slices;
  const raw = slices.map((s) => (s.amount / total) * 100);
  const floors = raw.map(Math.floor);
  let remaining = 100 - floors.reduce((s, x) => s + x, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (remaining <= 0) break;
    floors[i] += 1;
    remaining -= 1;
  }
  return slices.map((s, i) => ({ ...s, percent: floors[i] }));
}

// ── Deposit insurance ───────────────────────────────────────────────────────

export interface Exposure {
  key: string;
  bankName: string;
  holderLabel: string;
  insurer: string;
  /** IDR held at this bank in this holder's name. */
  total: number;
  /** The scheme's cap converted to IDR. */
  capIdr: number;
  ratio: number;
  /** Accounts that make up this exposure. */
  ids: string[];
}

/**
 * Deposit insurance is per depositor per bank: LPS covers up to Rp 2 M per
 * person per bank, SDIC S$100k, FDIC US$250k, and so on (BANK_COUNTRIES).
 * A foreign cap converts to IDR at today's rate; without a rate it is left
 * out rather than guessed.
 */
export function insuranceExposures(
  rows: readonly RekeningRow[],
  rates: FxRatesResponse | undefined,
): Exposure[] {
  const map = new Map<string, Exposure>();
  for (const row of rows) {
    if (row.balance === null || row.account.status === "closed") continue;
    const scheme = bankCountry(row.country);
    const perUnit =
      scheme.currency === "IDR"
        ? 1
        : Number(rates?.idrPerUnit?.[scheme.currency] ?? NaN);
    if (!Number.isFinite(perUnit) || perUnit <= 0) continue;
    const key = `${row.bankKey}|${row.holderKey}`;
    const exp = map.get(key) ?? {
      key,
      bankName: row.bankName,
      holderLabel: row.holderLabel,
      insurer: scheme.insurer,
      total: 0,
      capIdr: scheme.insuranceCap * perUnit,
      ratio: 0,
      ids: [],
    };
    exp.total += row.balance;
    exp.ids.push(row.account.id);
    exp.ratio = exp.total / exp.capIdr;
    map.set(key, exp);
  }
  return [...map.values()].sort((a, b) => b.ratio - a.ratio);
}

/** Share (0..1) of the total that sits within each exposure's cap. */
export function insuredShare(exposures: readonly Exposure[]): number {
  const total = exposures.reduce((s, e) => s + e.total, 0);
  if (total <= 0) return 1;
  const covered = exposures.reduce(
    (s, e) => s + Math.min(e.total, e.capIdr),
    0,
  );
  return covered / total;
}

// ── Liquidity & interest ────────────────────────────────────────────────────

export interface Liquidity {
  total: number;
  liquid: number;
  locked: number;
  maturingSoon: number;
}

export function liquidity(rows: readonly RekeningRow[]): Liquidity {
  let liquid = 0;
  let locked = 0;
  let maturingSoon = 0;
  for (const row of rows) {
    if (row.balance === null || row.account.status === "closed") continue;
    if (row.kind === "time_deposit") {
      locked += row.balance;
      if (
        row.daysToMaturity !== null &&
        row.daysToMaturity >= 0 &&
        row.daysToMaturity <= MATURITY_WARNING_DAYS
      )
        maturingSoon += 1;
    } else {
      liquid += row.balance;
    }
  }
  return { total: liquid + locked, liquid, locked, maturingSoon };
}

/**
 * Estimated interest for one month, after Indonesian final tax on domestic
 * accounts. A mudharabah account's "rate" is a profit-sharing nisbah, not a
 * yield, so it is left out instead of being read as a percentage return.
 */
export function monthlyNetInterest(rows: readonly RekeningRow[]): number {
  return rows.reduce((sum, row) => {
    const rate = row.account.interestRate;
    if (row.balance === null || !rate || row.account.status === "closed")
      return sum;
    if (row.account.isSharia && row.account.shariaContract === "mudharabah")
      return sum;
    return (
      sum + estimateNetInterest(row.balance, rate, 1, row.country === "ID")
    );
  }, 0);
}

// ── Attention ───────────────────────────────────────────────────────────────

export type AttentionItem =
  | { kind: "maturity"; row: RekeningRow; days: number }
  | { kind: "insurance"; exposure: Exposure; over: boolean }
  | { kind: "idle"; rows: RekeningRow[] }
  | { kind: "taxReport"; rows: RekeningRow[] };

export function attentionItems(
  rows: readonly RekeningRow[],
  exposures: readonly Exposure[],
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const maturing = rows
    .filter(
      (r) =>
        r.daysToMaturity !== null &&
        r.daysToMaturity >= 0 &&
        r.daysToMaturity <= MATURITY_WARNING_DAYS &&
        r.account.status !== "closed",
    )
    .sort((a, b) => (a.daysToMaturity ?? 0) - (b.daysToMaturity ?? 0));
  for (const row of maturing)
    items.push({ kind: "maturity", row, days: row.daysToMaturity ?? 0 });
  for (const exposure of exposures) {
    if (exposure.ratio >= INSURANCE_NEAR_RATIO)
      items.push({ kind: "insurance", exposure, over: exposure.ratio > 1 });
  }
  const idle = rows.filter(
    (r) =>
      r.idleDays >= IDLE_DAYS_WARNING &&
      (r.account.status ?? "active") === "active" &&
      r.kind !== "time_deposit",
  );
  if (idle.length > 0) items.push({ kind: "idle", rows: idle });
  const unreported = rows.filter(
    (r) =>
      r.country !== "ID" &&
      !r.account.reportInTaxReturn &&
      r.account.status !== "closed",
  );
  if (unreported.length > 0)
    items.push({ kind: "taxReport", rows: unreported });
  return items;
}

// ── Filters & grouping ──────────────────────────────────────────────────────

export type AccessFilter = "all" | "mine" | "sharedWithMe" | "family";
export type StatusFilter = "open" | "all" | "closed";

export interface RekeningFilters {
  query: string;
  banks: readonly string[];
  holders: readonly string[];
  kinds: readonly BankProductKind[];
  access: AccessFilter;
  status: StatusFilter;
  hideEmpty: boolean;
}

export const EMPTY_FILTERS: RekeningFilters = {
  query: "",
  banks: [],
  holders: [],
  kinds: [],
  access: "all",
  status: "open",
  hideEmpty: true,
};

/**
 * True when a search or filter narrows the rows. `hideEmpty` only folds
 * empty bank groups in the list, so it never counts; the default status is
 * "open" (closed accounts never carry a balance in the totals).
 */
export function hasActiveFilters(f: RekeningFilters): boolean {
  return (
    f.query.trim() !== "" ||
    f.banks.length > 0 ||
    f.holders.length > 0 ||
    f.kinds.length > 0 ||
    f.access !== EMPTY_FILTERS.access ||
    f.status !== EMPTY_FILTERS.status
  );
}

export function applyFilters(
  rows: readonly RekeningRow[],
  f: RekeningFilters,
  myUserId: string | undefined,
): RekeningRow[] {
  const q = f.query.trim().toLowerCase();
  return rows.filter((row) => {
    const a = row.account;
    if (f.banks.length > 0 && !f.banks.includes(row.bankKey)) return false;
    if (f.holders.length > 0 && !f.holders.includes(row.holderKey))
      return false;
    if (f.kinds.length > 0 && !f.kinds.includes(row.kind)) return false;
    if (f.access === "mine" && a.ownerUserId !== myUserId) return false;
    if (f.access === "family" && a.ownerUserId !== null) return false;
    if (
      f.access === "sharedWithMe" &&
      !(a.shares ?? []).some((s) => s.userId === myUserId)
    )
      return false;
    const status = a.status ?? "active";
    if (f.status === "open" && status === "closed") return false;
    if (f.status === "closed" && status !== "closed") return false;
    if (q) {
      const hay = [
        a.name,
        a.institution,
        a.productName,
        a.maskedNumber,
        row.holderLabel,
        a.branch,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export interface BankGroup {
  key: string;
  bankName: string;
  bank: KnownBank | null;
  country: string;
  total: number;
  rows: RekeningRow[];
  /** Rows with a zero balance, folded away while `hideEmpty` is on. */
  emptyRows: RekeningRow[];
}

export function groupByBank(
  rows: readonly RekeningRow[],
  hideEmpty: boolean,
): BankGroup[] {
  const map = new Map<string, BankGroup>();
  for (const row of rows) {
    const g = map.get(row.bankKey) ?? {
      key: row.bankKey,
      bankName: row.bankName,
      bank: row.bank,
      country: row.country,
      total: 0,
      rows: [],
      emptyRows: [],
    };
    g.total += row.balance ?? 0;
    if (hideEmpty && row.balance === 0) g.emptyRows.push(row);
    else g.rows.push(row);
    map.set(row.bankKey, g);
  }
  for (const g of map.values())
    g.rows.sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));
  return [...map.values()].sort((a, b) => b.total - a.total);
}
