import {
  bankCountry,
  type AccountDto,
  type AccountOwnershipForm,
  type AccountStatus,
  type BankInstitutionKind,
  type BankProductKind,
  type DepositInterestPayout,
  type DepositMaturityInstruction,
  type FxCurrencyCode,
  type ShariaContract,
} from "@wealthme/contracts";

import { findKnownBank } from "./bank-directory";

/**
 * Rekening v3 — the bank-account form's state and the pure transforms
 * around it (prefill from an account, bank autofill, validation, request
 * bodies). The React form only renders this; every rule lives here, tested.
 */

export const OTHER = "__other";
export type ShareRight = "none" | "view" | "post";

export interface MoneyRow {
  raw: string;
  /** null = follow the viewer's display currency until first edit. */
  currency: FxCurrencyCode | null;
}

export interface AccountFormState {
  country: string;
  bank: string;
  /** Typing a bank name instead of picking one. */
  bankOther: boolean;
  institutionKind: BankInstitutionKind | "";
  isSharia: boolean;
  bankCode: string;
  swiftCode: string;
  routingCode: string;
  productKind: BankProductKind;
  productName: string;
  maskedNumber: string;
  depositNumber: string;
  /** Member user id, OTHER for a typed name, or "" when not recorded yet. */
  holder: string;
  holderName: string;
  ownershipForm: AccountOwnershipForm;
  displayName: string;
  balances: MoneyRow[];
  openingBalanceDate: string;
  interestRate: string;
  shariaContract: ShariaContract | "";
  placementDate: string;
  tenorMonths: string;
  interestPayout: DepositInterestPayout;
  maturityInstruction: DepositMaturityInstruction;
  payoutAccountId: string;
  maturityReminder: boolean;
  familyShared: boolean;
  /** The "Rekening bersama keluarga" control was changed in this session. */
  ownerTouched: boolean;
  shares: Record<string, ShareRight>;
  isPrivate: boolean;
  status: AccountStatus;
  branch: string;
  isPrimary: boolean;
  notes: string;
  reportInTaxReturn: boolean;
  /** Member user id, OTHER, or "" for none. */
  beneficiary: string;
  beneficiaryName: string;
}

export interface FormContext {
  myUserId: string | undefined;
  isMasterLike: boolean;
  today: string;
}

export const TENOR_PRESETS = [1, 3, 6, 12, 24] as const;

export function initialFormState(
  account: AccountDto | null,
  ctx: FormContext,
  preset?: { productKind?: BankProductKind; country?: string },
): AccountFormState {
  if (!account) {
    return {
      country: preset?.country ?? "ID",
      bank: "",
      bankOther: false,
      institutionKind: "",
      isSharia: false,
      bankCode: "",
      swiftCode: "",
      routingCode: "",
      productKind: preset?.productKind ?? "savings",
      productName: "",
      maskedNumber: "",
      depositNumber: "",
      holder: ctx.myUserId ?? OTHER,
      holderName: "",
      ownershipForm: "individual",
      displayName: "",
      balances: [{ raw: "", currency: null }],
      openingBalanceDate: ctx.today,
      interestRate: "",
      shariaContract: "",
      placementDate: ctx.today,
      tenorMonths: "3",
      interestPayout: "at_maturity",
      maturityInstruction: "aro",
      payoutAccountId: "",
      maturityReminder: true,
      familyShared: ctx.isMasterLike,
      ownerTouched: false,
      shares: {},
      isPrivate: false,
      status: "active",
      branch: "",
      isPrimary: false,
      notes: "",
      reportInTaxReturn: (preset?.country ?? "ID") !== "ID",
      beneficiary: "",
      beneficiaryName: "",
    };
  }
  // Accounts saved before "Atas nama" existed carry no holder: prefill the
  // owning member when there is one, else leave it unrecorded ("").
  const holder =
    account.holderUserId ??
    (account.holderName ? OTHER : (account.ownerUserId ?? ""));
  return {
    country: account.country ?? "ID",
    bank: account.institution ?? "",
    bankOther: !!account.institution && !findKnownBank(account.institution),
    institutionKind: account.institutionKind ?? "",
    isSharia: account.isSharia ?? false,
    bankCode: account.bankCode ?? "",
    swiftCode: account.swiftCode ?? "",
    routingCode: account.routingCode ?? "",
    productKind: account.productKind ?? "savings",
    productName: account.productName ?? "",
    maskedNumber: account.maskedNumber ?? "",
    depositNumber: account.depositNumber ?? "",
    holder,
    holderName: holder === OTHER ? (account.holderName ?? "") : "",
    ownershipForm: account.ownershipForm ?? "individual",
    displayName: account.name,
    balances: [{ raw: "", currency: "IDR" }],
    openingBalanceDate: account.openingBalanceDate ?? "",
    interestRate:
      account.interestRate === null || account.interestRate === undefined
        ? ""
        : String(account.interestRate).replace(".", ","),
    shariaContract: account.shariaContract ?? "",
    placementDate: account.placementDate ?? "",
    tenorMonths: account.tenorMonths ? String(account.tenorMonths) : "",
    interestPayout: account.interestPayout ?? "at_maturity",
    maturityInstruction: account.maturityInstruction ?? "aro",
    payoutAccountId: account.payoutAccountId ?? "",
    maturityReminder: account.maturityReminder ?? false,
    familyShared: account.ownerUserId === null,
    ownerTouched: false,
    shares: Object.fromEntries(
      (account.shares ?? []).map((s) => [
        s.userId,
        s.canPost ? "post" : "view",
      ]),
    ),
    isPrivate: account.isPrivate,
    status: account.status ?? "active",
    branch: account.branch ?? "",
    isPrimary: account.isPrimary ?? false,
    notes: account.notes ?? "",
    reportInTaxReturn: account.reportInTaxReturn ?? false,
    beneficiary:
      account.beneficiaryUserId ?? (account.beneficiaryName ? OTHER : ""),
    beneficiaryName: account.beneficiaryName ?? "",
  };
}

/** Picking a bank fills in what the directory knows; typed values stay editable. */
export function applyBank(
  state: AccountFormState,
  bankName: string,
): AccountFormState {
  const known = findKnownBank(bankName);
  if (!known) return { ...state, bank: bankName };
  return {
    ...state,
    bank: known.name,
    country: known.country,
    institutionKind: known.kind,
    isSharia: known.isSharia ?? false,
    bankCode: known.bankCode ?? "",
    swiftCode: known.swift ?? "",
    shariaContract: known.isSharia ? state.shariaContract || "mudharabah" : "",
  };
}

/** Switching country resets bank-specific fields that no longer apply. */
export function applyCountry(
  state: AccountFormState,
  country: string,
): AccountFormState {
  if (country === state.country) return state;
  const scheme = bankCountry(country);
  return {
    ...state,
    country: scheme.code,
    bank: "",
    bankOther: false,
    institutionKind: scheme.code === "ID" ? "" : "foreign",
    isSharia: false,
    bankCode: "",
    swiftCode: "",
    routingCode: "",
    shariaContract: "",
    productKind:
      scheme.code === "ID" && state.productKind === "multi_currency"
        ? "savings"
        : scheme.code !== "ID" && state.productKind === "planned_savings"
          ? "savings"
          : state.productKind,
    balances: state.balances.map((b) => ({ ...b, currency: scheme.currency })),
    reportInTaxReturn: scheme.code !== "ID",
  };
}

const SWIFT = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

/** "4,25" / "4.25" → 4.25; "" → null; NaN when unparsable. */
export function parseRate(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return Number(trimmed.replace(",", "."));
}

export type FormErrors = Partial<
  Record<
    | "bank"
    | "holderName"
    | "swiftCode"
    | "interestRate"
    | "placementDate"
    | "tenorMonths",
    "required" | "invalid"
  >
>;

export function validateForm(state: AccountFormState): FormErrors {
  const errors: FormErrors = {};
  if (!state.bank.trim()) errors.bank = "required";
  if (state.holder === OTHER && !state.holderName.trim())
    errors.holderName = "required";
  if (state.swiftCode && !SWIFT.test(state.swiftCode.toUpperCase()))
    errors.swiftCode = "invalid";
  const rate = parseRate(state.interestRate);
  if (rate !== null && !(rate >= 0 && rate <= 100))
    errors.interestRate = "invalid";
  if (state.productKind === "time_deposit") {
    if (!state.placementDate) errors.placementDate = "required";
    const tenor = Number(state.tenorMonths);
    if (!Number.isInteger(tenor) || tenor < 1 || tenor > 120)
      errors.tenorMonths = "invalid";
  }
  return errors;
}

/** One balance converted to IDR (the ledger currency) by the caller. */
export interface ConvertedBalance {
  currency: FxCurrencyCode;
  idr: number;
  /** Canonical foreign amount, sent as fxInputs so the server converts it. */
  fxAmount: string | null;
}

const isDeposit = (s: AccountFormState) => s.productKind === "time_deposit";

/** The account's display name: typed, else "<bank> <product or kind>". */
export function accountName(
  state: AccountFormState,
  kindLabel: string,
  currency?: string,
): string {
  const typed = state.displayName.trim();
  const base =
    typed ||
    `${state.bank.trim()} ${state.productName.trim() || kindLabel}`.trim();
  return currency ? `${base} (${currency})` : base;
}

/**
 * The banking detail shared by create and edit. Owner and shares are only
 * sent by Master/Co-Master: the API pins everyone else to themselves and
 * rejects a share list from them.
 */
export function detailBody(
  state: AccountFormState,
  ctx: FormContext,
  mode: "add" | "edit" = "add",
): Record<string, unknown> {
  const deposit = isDeposit(state);
  const holderIsMember = state.holder !== OTHER && state.holder !== "";
  const rate = parseRate(state.interestRate);
  const body: Record<string, unknown> = {
    institution: state.bank.trim(),
    country: state.country,
    institutionKind: state.institutionKind || null,
    isSharia: state.isSharia,
    bankCode: state.bankCode.trim() || null,
    swiftCode: state.swiftCode.trim().toUpperCase() || null,
    routingCode: state.routingCode.trim() || null,
    routingCodeKind: state.routingCode.trim()
      ? bankCountry(state.country).routingKind
      : null,
    productKind: state.productKind,
    productName: state.productName.trim() || null,
    maskedNumber: state.maskedNumber.trim() || undefined,
    ownershipForm: state.ownershipForm,
    status: state.status,
    openingBalanceDate:
      (deposit ? state.placementDate : state.openingBalanceDate) || null,
    interestRate: rate,
    shariaContract: state.isSharia ? state.shariaContract || null : null,
    branch: state.branch.trim() || null,
    isPrimary: state.isPrimary,
    notes: state.notes.trim() || null,
    reportInTaxReturn: state.country !== "ID" && state.reportInTaxReturn,
    isPrivate: state.isPrivate,
    depositNumber: deposit ? state.depositNumber.trim() || null : null,
    placementDate: deposit ? state.placementDate || null : null,
    tenorMonths: deposit ? Number(state.tenorMonths) : null,
    interestPayout: deposit ? state.interestPayout : null,
    maturityInstruction: deposit ? state.maturityInstruction : null,
    payoutAccountId: deposit ? state.payoutAccountId || null : null,
    maturityReminder: deposit && state.maturityReminder,
  };
  if (holderIsMember) {
    body.holderUserId = state.holder;
  } else {
    body.holderUserId = null;
    body.holderName =
      state.holder === OTHER ? state.holderName.trim() || null : null;
  }
  if (state.beneficiary === OTHER) {
    body.beneficiaryUserId = null;
    body.beneficiaryName = state.beneficiaryName.trim() || null;
  } else {
    body.beneficiaryUserId = state.beneficiary || null;
    if (!state.beneficiary) body.beneficiaryName = null;
  }
  if (ctx.isMasterLike) {
    // On edit, ownership moves only when the family-shared control itself
    // was changed: deriving it from "Atas nama" silently reassigned a
    // member's account to whoever edited it (review finding).
    if (mode === "add" || state.ownerTouched)
      body.ownerUserId = state.familyShared
        ? null
        : holderIsMember
          ? state.holder
          : (ctx.myUserId ?? null);
    body.shares = state.isPrivate
      ? []
      : Object.entries(state.shares)
          .filter(([, right]) => right !== "none")
          .map(([userId, right]) => ({ userId, canPost: right === "post" }));
  }
  return body;
}

/** POST bodies: one per currency (a multi-currency account is one row per currency). */
export function createBodies(
  state: AccountFormState,
  ctx: FormContext,
  converted: readonly ConvertedBalance[],
  kindLabel: string,
): Record<string, unknown>[] {
  const detail = detailBody(state, ctx);
  // Create treats `null` as "not set": drop nulls so optional columns use
  // their defaults instead of failing a non-null validator.
  const compact = Object.fromEntries(
    Object.entries(detail).filter(([, v]) => v !== null && v !== undefined),
  );
  if (ctx.isMasterLike && detail.ownerUserId === null)
    delete compact.ownerUserId;
  const multi = state.productKind === "multi_currency" && converted.length > 1;
  return converted.map((bal) => ({
    ...compact,
    type: "bank",
    name: accountName(state, kindLabel, multi ? bal.currency : undefined),
    balance: bal.idr,
    currency: bal.currency,
    ...(bal.fxAmount
      ? {
          fxInputs: [
            { field: "balance", currency: bal.currency, amount: bal.fxAmount },
          ],
        }
      : {}),
  }));
}

/** PATCH body: the detail plus the name; never a balance (it moves only via transactions). */
export function editBody(
  state: AccountFormState,
  ctx: FormContext,
  kindLabel: string,
): Record<string, unknown> {
  return {
    ...detailBody(state, ctx, "edit"),
    name: accountName(state, kindLabel),
  };
}
