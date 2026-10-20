import type { AccountDto, FxRatesResponse } from "@wealthme/contracts";

import {
  EMPTY_FILTERS,
  applyFilters,
  hasActiveFilters,
  formatNative,
  needsCheck,
  toRows,
  totals,
} from "./kas-model";
import { maskIdentifier, providersForCountry } from "./wallet-directory";

const NOW = new Date("2026-10-19T12:00:00.000Z");
const RATES = {
  base: "IDR",
  rates: {},
  rateDate: "2026-10-19",
  source: "frankfurter",
  stale: false,
  idrPerUnit: { USD: "16850.000000" },
} as FxRatesResponse;

function acc(p: Partial<AccountDto>): AccountDto {
  return {
    id: p.name ?? "x",
    familyGroupId: "f",
    name: "x",
    type: "cash",
    institution: null,
    maskedNumber: null,
    balance: "0",
    currency: "IDR",
    isPrivate: false,
    ownerUserId: null,
    ownerName: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...p,
  };
}

const accounts = [
  acc({
    name: "Dompet Harian",
    balance: "3000000",
    ownerUserId: "u1",
    ownerName: "Christian",
    lastReconciledAt: "2026-10-19T08:00:00.000Z",
  }),
  acc({
    name: "Travel Cash",
    balance: "505500",
    currency: "USD",
    country: "US",
    lastReconciledAt: "2026-10-10T08:00:00.000Z",
  }),
  acc({
    name: "GoPay Pribadi",
    type: "ewallet",
    institution: "GoPay",
    balance: "1200000",
    shares: [{ userId: "u2", name: "V", canPost: false }],
  }),
  acc({
    name: "Titipan",
    balance: "900000",
    includeInNetWorth: false,
    lastReconciledAt: "2026-10-18T08:00:00.000Z",
  }),
  acc({ name: "BCA", type: "bank", balance: "99" }),
];

describe("kas-model", () => {
  const rows = toRows(accounts, RATES, NOW, "Keluarga");

  it("keeps only cash and e-wallets and converts native amounts", () => {
    expect(rows).toHaveLength(4);
    const travel = rows.find((r) => r.account.name === "Travel Cash")!;
    expect(travel.native).toBeCloseTo(30, 2);
    expect(
      rows.find((r) => r.account.name === "GoPay Pribadi")!.provider?.key,
    ).toBe("gopay");
  });

  it("totals skip accounts kept out of net worth", () => {
    const t = totals(rows);
    expect(t.total).toBe(3000000 + 505500 + 1200000);
    expect(t.cash).toBe(3505500);
    expect(t.cashCount).toBe(3);
    expect(t.currencies).toBe(2);
  });

  it("flags never-checked first, then the oldest check over the limit", () => {
    expect(needsCheck(rows).map((r) => r.account.name)).toEqual([
      "GoPay Pribadi",
      "Travel Cash",
    ]);
  });

  it("filters by kind, currency, owner and text", () => {
    expect(
      applyFilters(rows, { ...EMPTY_FILTERS, kind: "ewallet" }),
    ).toHaveLength(1);
    expect(
      applyFilters(rows, { ...EMPTY_FILTERS, currency: "USD" }),
    ).toHaveLength(1);
    expect(applyFilters(rows, { ...EMPTY_FILTERS, owner: "u1" })).toHaveLength(
      1,
    );
    expect(applyFilters(rows, { ...EMPTY_FILTERS, q: "gopay" })).toHaveLength(
      1,
    );
  });

  it("formats native amounts by currency precision", () => {
    expect(formatNative(30, "USD", "id")).toBe("USD 30,00");
    expect(formatNative(3000000, "IDR", "id")).toBe("IDR 3.000.000");
  });
});

describe("wallet-directory", () => {
  it("lists local providers before the global ones", () => {
    const names = providersForCountry("ID").map((p) => p.key);
    expect(names.slice(0, 5)).toEqual([
      "gopay",
      "ovo",
      "dana",
      "shopeepay",
      "linkaja",
    ]);
    expect(names).toContain("paypal");
    expect(providersForCountry("PH").map((p) => p.key)).toContain("gcash");
  });

  it("masks phone numbers and emails", () => {
    expect(maskIdentifier("+62 812 3456 9012")).toBe("••9012");
    expect(maskIdentifier("christian@mail.com")).toBe("c•••@mail.com");
  });
});

// Client bug 2026-10-21 — the /dana summary ignored search and filters.
describe("hasActiveFilters + totals(applyFilters(...))", () => {
  it("treats only a non-empty search or filter as active", () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, q: "  " })).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, q: "gopay" })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, kind: "cash" })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, owner: "" })).toBe(true);
  });
});
