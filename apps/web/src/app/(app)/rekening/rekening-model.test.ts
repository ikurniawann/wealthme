import type { AccountDto, FxRatesResponse } from "@wealthme/contracts";

import { findKnownBank } from "./bank-directory";
import {
  EMPTY_FILTERS,
  hasActiveFilters,
  applyFilters,
  attentionItems,
  composition,
  groupByBank,
  insuranceExposures,
  insuredShare,
  liquidity,
  monthlyNetInterest,
  toRows,
} from "./rekening-model";

const TODAY = "2026-10-19";
const LABELS = { family: "Keluarga" };

function acc(overrides: Partial<AccountDto>): AccountDto {
  return {
    id: overrides.id ?? "a",
    familyGroupId: "fg",
    name: "Rekening",
    type: "bank",
    institution: "BCA",
    maskedNumber: null,
    balance: "0",
    currency: "IDR",
    isPrivate: false,
    ownerUserId: null,
    ownerName: null,
    createdAt: "2026-10-18T00:00:00.000Z",
    updatedAt: "2026-10-18T00:00:00.000Z",
    lastActivityAt: TODAY,
    ...overrides,
  };
}

const rows = (accounts: AccountDto[]) => toRows(accounts, TODAY, LABELS);

describe("findKnownBank", () => {
  it("prefers the longer match: BCA Syariah is not BCA", () => {
    expect(findKnownBank("BCA Syariah")?.name).toBe("BCA Syariah");
    expect(findKnownBank("Bank Central Asia")?.name).toBe("BCA");
  });

  it("does not match a short code inside another word", () => {
    expect(findKnownBank("Bank Abri Lokal")).toBeNull();
  });
});

describe("composition", () => {
  it("folds the tail past maxSlices into one 'other' slice so the legend stays bounded", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      acc({ id: `a${i}`, institution: `Bank ${i}`, balance: String(1000 - i) }),
    );
    const slices = composition(
      rows(many),
      "bank",
      (r) => r.bankName,
      "Lainnya",
      5,
    );
    expect(slices).toHaveLength(5);
    expect(slices[4]).toMatchObject({
      key: "__other",
      label: "Lainnya",
      count: 8,
    });
  });

  it("percentages always add up to 100", () => {
    const three = ["1", "1", "1"].map((b, i) =>
      acc({ id: `a${i}`, institution: `Bank ${i}`, balance: b }),
    );
    const slices = composition(rows(three), "bank", (r) => r.bankName, "x");
    expect(slices.reduce((s, x) => s + x.percent, 0)).toBe(100);
  });

  it("ignores zero and hidden balances", () => {
    const slices = composition(
      rows([acc({ balance: "0" }), acc({ id: "b", balance: null })]),
      "bank",
      (r) => r.bankName,
      "x",
    );
    expect(slices).toEqual([]);
  });
});

describe("insuranceExposures (LPS / SDIC)", () => {
  const rates = {
    idrPerUnit: { SGD: "12500" },
  } as unknown as FxRatesResponse;

  it("sums per bank per holder against Rp 2 M", () => {
    const exp = insuranceExposures(
      rows([
        acc({
          id: "1",
          balance: "1500000000",
          holderUserId: "u1",
          holderName: "Irfan",
        }),
        acc({
          id: "2",
          balance: "600000000",
          holderUserId: "u1",
          holderName: "Irfan",
        }),
        acc({
          id: "3",
          balance: "100000000",
          holderUserId: "u2",
          holderName: "Mel",
        }),
      ]),
      undefined,
    );
    expect(exp[0]).toMatchObject({
      holderLabel: "Irfan",
      total: 2_100_000_000,
      insurer: "LPS",
    });
    expect(exp[0].ratio).toBeCloseTo(1.05);
    expect(insuredShare(exp)).toBeCloseTo(2_100_000_000 / 2_200_000_000);
  });

  it("converts a foreign cap at today's rate and skips it without a rate", () => {
    const sg = acc({
      id: "sg",
      institution: "DBS Bank",
      country: "SG",
      balance: "625000000",
    });
    expect(insuranceExposures(rows([sg]), rates)[0]).toMatchObject({
      insurer: "SDIC",
      capIdr: 1_250_000_000,
      ratio: 0.5,
    });
    expect(insuranceExposures(rows([sg]), undefined)).toEqual([]);
  });
});

describe("liquidity & interest", () => {
  it("splits liquid from deposits and counts deposits maturing within 30 days", () => {
    const l = liquidity(
      rows([
        acc({ id: "s", balance: "100" }),
        acc({
          id: "d",
          balance: "300",
          productKind: "time_deposit",
          placementDate: "2026-08-01",
          tenorMonths: 3,
          maturityInstruction: "non_aro",
        }),
      ]),
    );
    expect(l).toEqual({
      total: 400,
      liquid: 100,
      locked: 300,
      maturingSoon: 1,
    });
  });

  it("taxes domestic interest 20% above Rp 7,5 jt and skips mudharabah nisbah", () => {
    const net = monthlyNetInterest(
      rows([
        acc({ id: "1", balance: "120000000", interestRate: 1 }),
        acc({
          id: "2",
          balance: "120000000",
          interestRate: 40,
          isSharia: true,
          shariaContract: "mudharabah",
        }),
      ]),
    );
    // 120 jt × 1% / 12 = 100.000 gross, − 20% = 80.000
    expect(net).toBe(80_000);
  });
});

describe("attentionItems", () => {
  it("flags maturity, insurance, idle accounts and unreported foreign accounts", () => {
    const r = rows([
      acc({
        id: "dep",
        productKind: "time_deposit",
        placementDate: "2026-07-31",
        tenorMonths: 3,
        maturityInstruction: "aro",
        balance: "5",
      }),
      acc({ id: "big", balance: "2100000000", holderUserId: "u1" }),
      acc({ id: "idle", balance: "0", lastActivityAt: "2026-06-01" }),
      acc({ id: "sg", country: "SG", institution: "DBS Bank", balance: "1" }),
    ]);
    const kinds = attentionItems(r, insuranceExposures(r, undefined)).map(
      (i) => i.kind,
    );
    expect(kinds).toEqual(["maturity", "insurance", "idle", "taxReport"]);
  });
});

describe("filters & grouping", () => {
  const data = rows([
    acc({
      id: "1",
      institution: "BCA",
      balance: "10",
      ownerUserId: "me",
      productKind: "savings",
    }),
    acc({ id: "2", institution: "BCA", balance: "0" }),
    acc({ id: "3", institution: "Mandiri", balance: "50", status: "closed" }),
    acc({
      id: "4",
      institution: "BNI",
      balance: "5",
      shares: [{ userId: "me", name: "Me", canPost: false }],
    }),
  ]);

  it("hides closed accounts by default and filters by access", () => {
    expect(
      applyFilters(data, EMPTY_FILTERS, "me").map((r) => r.account.id),
    ).toEqual(["1", "2", "4"]);
    expect(
      applyFilters(
        data,
        { ...EMPTY_FILTERS, access: "sharedWithMe" },
        "me",
      ).map((r) => r.account.id),
    ).toEqual(["4"]);
  });

  it("groups by bank, largest first, folding zero balances away", () => {
    const groups = groupByBank(applyFilters(data, EMPTY_FILTERS, "me"), true);
    expect(groups.map((g) => g.bankName)).toEqual(["BCA", "BNI"]);
    expect(groups[0].rows.map((r) => r.account.id)).toEqual(["1"]);
    expect(groups[0].emptyRows.map((r) => r.account.id)).toEqual(["2"]);
  });
});

// Client bug 2026-10-21 — the hero summary ignored search and filters.
describe("hasActiveFilters", () => {
  it("ignores the defaults and hideEmpty, flags any narrowing", () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, hideEmpty: false })).toBe(
      false,
    );
    expect(hasActiveFilters({ ...EMPTY_FILTERS, query: "bca" })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, banks: ["bca"] })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, status: "all" })).toBe(true);
  });
});
