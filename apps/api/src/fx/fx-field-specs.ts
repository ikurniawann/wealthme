import type { FxFieldSpec } from "./fx-input.resolve";

const MAX_12_DIGITS = 999_999_999_999n;
/** decimal2 fields store sen (value × 100); Decimal(18,2) columns cap magnitude at 10^18 - 1 sen. */
const MAX_DECIMAL2_SEN = 10n ** 18n - 1n;

export function accountBalanceSpec(type?: string): FxFieldSpec {
  return { balance: { kind: "int", allowNegative: type === "cash" } };
}

export const FX_FIELD_SPECS = {
  transaction: { amount: { kind: "int", positive: true } },
  budget: { limitAmount: { kind: "int", positive: true, max: MAX_12_DIGITS } },
  goal: {
    targetAmount: { kind: "int", positive: true, max: MAX_12_DIGITS },
    currentAmount: { kind: "int", max: MAX_12_DIGITS },
    autoDebitAmount: { kind: "int", positive: true, max: MAX_12_DIGITS },
  },
  goalContribution: {
    amount: { kind: "digits", positive: true, max: MAX_12_DIGITS },
  },
  allowanceRequest: { amount: { kind: "int", positive: true } },
  asset: {
    currentValue: { kind: "digits" },
    valueChangeAmount: { kind: "digits", allowNegative: true },
  },
  assetHistory: { value: { kind: "digits" } },
  investment: {
    costBasisPerUnit: { kind: "decimal2", max: MAX_DECIMAL2_SEN },
  },
  // Review fix round 1, item 2 — the IDR path accepts 0 here (no @Min on
  // SetManualPriceDto.price / CreateInvestmentTransactionDto.pricePerUnit),
  // so the foreign path must too: non-negative, not strictly positive.
  investmentPrice: {
    price: { kind: "decimal2", max: MAX_DECIMAL2_SEN },
  },
  investmentTrade: {
    pricePerUnit: { kind: "decimal2", max: MAX_DECIMAL2_SEN },
  },
  liability: {
    totalDebt: { kind: "digits" },
    remainingBalance: { kind: "digits" },
    minimumPayment: { kind: "digits" },
    installmentAmount: { kind: "digits" },
  },
  liabilityPayment: { amount: { kind: "digits", positive: true } },
  // Revisi K — a recorded KPR prepayment debits an account like a payment does.
  liabilityPrepayment: { amount: { kind: "digits", positive: true } },
  insurance: {
    premiumAmount: { kind: "digits" },
    coverageAmount: { kind: "digits" },
  },
  insurancePayment: { amount: { kind: "digits", positive: true } },
  inheritance: { estimatedValue: { kind: "int" } },
  // CreateDonationDto.amount is `^\d+$` — unsigned, so 0 is valid on the IDR
  // path; the foreign path matches (review fix round 1, item 2).
  donation: { amount: { kind: "digits" } },
  splitBill: {
    totalAmount: { kind: "int", positive: true },
    "participants.*.amountOwed": { kind: "int" },
  },
  goldPrice: { pricePerGram: { kind: "int", positive: true } },
  memberThreshold: { largeTxnThreshold: { kind: "int", positive: true } },
} as const satisfies Record<string, FxFieldSpec>;
