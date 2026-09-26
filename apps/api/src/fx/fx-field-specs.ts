import type { FxFieldSpec } from "./fx-input.resolve";

const MAX_12_DIGITS = 999_999_999_999n;

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
  investment: { costBasisPerUnit: { kind: "decimal2" } },
  investmentPrice: { price: { kind: "decimal2", positive: true } },
  investmentTrade: { pricePerUnit: { kind: "decimal2", positive: true } },
  liability: {
    totalDebt: { kind: "digits" },
    remainingBalance: { kind: "digits" },
    minimumPayment: { kind: "digits" },
    installmentAmount: { kind: "digits" },
  },
  liabilityPayment: { amount: { kind: "digits", positive: true } },
  insurance: {
    premiumAmount: { kind: "digits" },
    coverageAmount: { kind: "digits" },
  },
  insurancePayment: { amount: { kind: "digits", positive: true } },
  inheritance: { estimatedValue: { kind: "int" } },
  donation: { amount: { kind: "digits", positive: true } },
  splitBill: {
    totalAmount: { kind: "int", positive: true },
    "participants.*.amountOwed": { kind: "int" },
  },
  goldPrice: { pricePerGram: { kind: "int", positive: true } },
  memberThreshold: { largeTxnThreshold: { kind: "int", positive: true } },
} as const satisfies Record<string, FxFieldSpec>;
