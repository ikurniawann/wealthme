import type { AccountDto, FxRatesResponse } from "@wealthme/contracts";

import {
  findProvider,
  walletCountry,
  type WalletProvider,
} from "./wallet-directory";

export type KasKind = "cash" | "ewallet";

/** A balance not confirmed for this many days asks to be checked. */
export const STALE_DAYS = 7;

export interface KasRow {
  account: AccountDto;
  kind: KasKind;
  country: string;
  currency: string;
  provider: WalletProvider | undefined;
  /** IDR balance as the API sent it; null = withheld from this viewer. */
  idr: number | null;
  /** Balance in the account's own currency at today's rate, or null. */
  native: number | null;
  ownerKey: string;
  ownerLabel: string;
  shared: boolean;
  checkedAt: string | null;
  /** Days since the last check; null = never checked. */
  checkedDaysAgo: number | null;
  stale: boolean;
  included: boolean;
}

const DAY_MS = 86_400_000;

export function daysSince(
  iso: string | null | undefined,
  now: Date,
): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / DAY_MS));
}

export function idrPerUnit(
  currency: string,
  rates: FxRatesResponse | undefined,
): number | null {
  if (currency === "IDR") return 1;
  const v = Number(rates?.idrPerUnit?.[currency] ?? NaN);
  return Number.isFinite(v) && v > 0 ? v : null;
}

export function toRows(
  accounts: readonly AccountDto[],
  rates: FxRatesResponse | undefined,
  now: Date,
  familyLabel: string,
): KasRow[] {
  return accounts
    .filter((a) => a.type === "cash" || a.type === "ewallet")
    .map((a) => {
      const kind = a.type as KasKind;
      const country = (a.country ?? "ID").toUpperCase();
      const currency = a.currency || walletCountry(country).currency;
      const idr =
        a.balance === null || a.balance === undefined
          ? null
          : Number(a.balance);
      const perUnit = idrPerUnit(currency, rates);
      const native = idr === null || perUnit === null ? null : idr / perUnit;
      const checkedDaysAgo = daysSince(a.lastReconciledAt, now);
      return {
        account: a,
        kind,
        country,
        currency,
        provider: kind === "ewallet" ? findProvider(a.institution) : undefined,
        idr,
        native,
        ownerKey: a.ownerUserId ?? "",
        ownerLabel: a.ownerName ?? (a.ownerUserId ? "—" : familyLabel),
        shared: (a.shares?.length ?? 0) > 0,
        checkedAt: a.lastReconciledAt ?? null,
        checkedDaysAgo,
        stale: checkedDaysAgo === null || checkedDaysAgo > STALE_DAYS,
        included: a.includeInNetWorth !== false,
      };
    });
}

export interface KasTotals {
  total: number;
  cash: number;
  ewallet: number;
  cashCount: number;
  ewalletCount: number;
  currencies: number;
}

/** Totals count only what the family put in net worth. */
export function totals(rows: readonly KasRow[]): KasTotals {
  const counted = rows.filter((r) => r.included);
  const sum = (k?: KasKind) =>
    counted
      .filter((r) => !k || r.kind === k)
      .reduce((s, r) => s + (r.idr ?? 0), 0);
  return {
    total: sum(),
    cash: sum("cash"),
    ewallet: sum("ewallet"),
    cashCount: rows.filter((r) => r.kind === "cash").length,
    ewalletCount: rows.filter((r) => r.kind === "ewallet").length,
    currencies: new Set(rows.map((r) => r.currency)).size,
  };
}

export interface KasFilters {
  q: string;
  kind: "all" | KasKind;
  country: string;
  currency: string;
  owner: string | null;
}

export const EMPTY_FILTERS: KasFilters = {
  q: "",
  kind: "all",
  country: "",
  currency: "",
  owner: null,
};

export function applyFilters(rows: readonly KasRow[], f: KasFilters): KasRow[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.kind !== "all" && r.kind !== f.kind) return false;
    if (f.country && r.country !== f.country) return false;
    if (f.currency && r.currency !== f.currency) return false;
    if (f.owner !== null && r.ownerKey !== f.owner) return false;
    if (!q) return true;
    const hay = [
      r.account.name,
      r.account.institution ?? "",
      r.provider?.name ?? "",
      r.account.storageLocation ?? "",
      r.ownerLabel,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

/** Stale rows, never-checked first, then the longest unchecked. */
export function needsCheck(rows: readonly KasRow[]): KasRow[] {
  return rows
    .filter((r) => r.stale && r.account.status !== "closed")
    .sort(
      (a, b) => (b.checkedDaysAgo ?? Infinity) - (a.checkedDaysAgo ?? Infinity),
    );
}

/** Native amount for display: "USD 30,00", "IDR 3.000.000". */
export function formatNative(
  amount: number,
  currency: string,
  locale: "id" | "en",
): string {
  const zeroDecimals =
    currency === "IDR" || currency === "JPY" || currency === "KRW";
  const n = amount.toLocaleString(locale === "en" ? "en-US" : "id-ID", {
    minimumFractionDigits: zeroDecimals ? 0 : 2,
    maximumFractionDigits: zeroDecimals ? 0 : 2,
  });
  return `${currency} ${n}`;
}
