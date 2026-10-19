import type { AccountDto } from "@wealthme/contracts";

import {
  findProvider,
  maskIdentifier,
  walletCountry,
} from "./wallet-directory";

export type KasKind = "cash" | "ewallet";

/** Select value for "Penyedia lainnya / kustom" and for the family-shared owner. */
export const OTHER_PROVIDER = "__other";
export const FAMILY_OWNER = "__family";

export interface KasFormState {
  name: string;
  /** True once the user typed a name, so a provider change stops overwriting it. */
  nameTouched: boolean;
  /** Member user id, or FAMILY_OWNER (Master/Co-Master only). */
  owner: string;
  currency: string;
  country: string;
  location: string;
  /** Provider key, OTHER_PROVIDER, or "". */
  provider: string;
  providerCustom: string;
  identifier: string;
  balanceRaw: string;
  date: string;
  shares: string[];
  includeInNetWorth: boolean;
  notes: string;
}

export interface KasFormContext {
  myUserId: string | undefined;
  isMasterLike: boolean;
  today: string;
}

export interface KasConverted {
  currency: string;
  idr: number;
  /** Canonical foreign amount, sent as fxInputs so the server converts it. */
  fxAmount: string | null;
}

export type KasErrors = Partial<
  Record<
    "name" | "owner" | "provider" | "identifier" | "balance" | "date",
    "required" | "negativeWallet"
  >
>;

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function initialKasState(
  kind: KasKind,
  account: AccountDto | null,
  ctx: KasFormContext,
  preset?: { country?: string; provider?: string },
): KasFormState {
  if (account) {
    const known =
      kind === "ewallet" ? findProvider(account.institution) : undefined;
    return {
      name: account.name,
      nameTouched: true,
      owner:
        account.ownerUserId ??
        (ctx.isMasterLike ? FAMILY_OWNER : (ctx.myUserId ?? "")),
      currency: account.currency,
      country: account.country ?? "ID",
      location: account.storageLocation ?? "",
      provider: kind === "ewallet" ? (known ? known.key : OTHER_PROVIDER) : "",
      providerCustom:
        kind === "ewallet" && !known ? (account.institution ?? "") : "",
      identifier: account.maskedNumber ?? "",
      balanceRaw: "",
      date: ctx.today,
      shares: (account.shares ?? []).map((s) => s.userId),
      includeInNetWorth: account.includeInNetWorth ?? true,
      notes: account.notes ?? "",
    };
  }
  const country = walletCountry(preset?.country).code;
  const provider =
    kind === "ewallet" ? (findProvider(preset?.provider)?.key ?? "") : "";
  return {
    name: "",
    nameTouched: false,
    owner: ctx.myUserId ?? "",
    currency: walletCountry(country).currency,
    country,
    location: "",
    provider,
    providerCustom: "",
    identifier: "",
    balanceRaw: "",
    date: ctx.today,
    shares: [],
    includeInNetWorth: true,
    notes: "",
  };
}

/** Provider display name: the directory entry, or what was typed for "other". */
export function providerName(s: KasFormState): string {
  if (s.provider === OTHER_PROVIDER) return s.providerCustom.trim();
  return findProvider(s.provider)?.name ?? "";
}

/** Wallets want a name per provider: "<Provider> Pribadi" until the user types one. */
export function defaultWalletName(s: KasFormState, suffix: string): string {
  const p = providerName(s);
  return p ? `${p} ${suffix}` : "";
}

export function validateKas(
  kind: KasKind,
  s: KasFormState,
  isEdit: boolean,
  suffix: string,
): KasErrors {
  const errors: KasErrors = {};
  const name =
    kind === "ewallet"
      ? s.name.trim() || defaultWalletName(s, suffix)
      : s.name.trim();
  if (!name) errors.name = "required";
  if (!s.owner) errors.owner = "required";
  if (kind === "ewallet") {
    if (!providerName(s)) errors.provider = "required";
    if (!s.identifier.trim()) errors.identifier = "required";
  }
  if (!isEdit) {
    const raw = s.balanceRaw.trim();
    if (raw === "" || raw === "-") errors.balance = "required";
    else if (kind === "ewallet" && raw.startsWith("-"))
      errors.balance = "negativeWallet";
    if (!s.date) errors.date = "required";
  }
  return errors;
}

/** The identifier as stored: phone numbers get the dial prefix, then everything is masked. */
export function storedIdentifier(s: KasFormState): string {
  const v = s.identifier.trim();
  const kind = findProvider(s.provider)?.idKind ?? "id";
  if (kind === "phone" && !v.startsWith("•") && !v.startsWith("+")) {
    return maskIdentifier(`${walletCountry(s.country).dial}${v}`);
  }
  return maskIdentifier(v);
}

/**
 * Create body (POST) or edit body (PATCH: no balance, date or fxInputs — a
 * balance moves only through transactions). Owner and shares are sent only by
 * Master/Co-Master; the API pins everyone else to themselves.
 */
export function buildKasBody(
  kind: KasKind,
  s: KasFormState,
  ctx: KasFormContext,
  mode: "add" | "edit",
  suffix: string,
  converted: KasConverted | null,
  initialOwner: string,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name:
      kind === "ewallet"
        ? s.name.trim() || defaultWalletName(s, suffix)
        : s.name.trim(),
    country: s.country,
    currency: s.currency,
    includeInNetWorth: s.includeInNetWorth,
  };
  if (kind === "cash") {
    body.storageLocation = s.location.trim() || null;
    body.notes = s.notes.trim() || null;
  }
  if (kind === "ewallet") {
    body.institution = providerName(s);
    body.maskedNumber = storedIdentifier(s);
  }
  if (ctx.isMasterLike && (mode === "add" || s.owner !== initialOwner)) {
    body.ownerUserId = s.owner === FAMILY_OWNER ? null : s.owner;
  }
  if (ctx.isMasterLike) {
    body.shares = s.shares.map((userId) => ({ userId, canPost: false }));
  }
  if (mode === "add") {
    body.type = kind;
    body.openingBalanceDate = s.date;
    if (converted) {
      body.balance = converted.idr;
      if (converted.fxAmount !== null) {
        body.fxInputs = [
          {
            field: "balance",
            currency: converted.currency,
            amount: converted.fxAmount,
          },
        ];
      }
    }
  }
  return body;
}
