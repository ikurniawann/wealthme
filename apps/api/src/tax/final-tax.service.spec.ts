import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";

import { FinalTaxService } from "./final-tax.service";

const FG = "fg-1";
const d = (v: string) => new Decimal(v);
const at = (date: string) => new Date(`${date}T03:00:00.000Z`); // 10:00 WIB

function inv(o: Record<string, unknown>) {
  return {
    id: "inv",
    name: "Holding",
    ticker: "",
    type: "saham",
    quantity: d("0"),
    costBasisPerUnit: d("0"),
    currency: "IDR",
    interestRatePct: null,
    purchasedAt: null,
    maturityDate: null,
    cryptoExchange: null,
    transactions: [],
    ...o,
  };
}

const prisma = {
  investment: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  account: { findFirst: jest.fn() },
  taxFinalIncomeEntry: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe("FinalTaxService.estimate", () => {
  const svc = new FinalTaxService(prisma as never);
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.taxFinalIncomeEntry.findMany.mockResolvedValue([]);
  });

  it("derives deposito, SBN, saham lines with golden numbers and skips foreign holdings", async () => {
    prisma.investment.findMany.mockResolvedValue([
      inv({
        id: "dep",
        type: "deposito",
        quantity: d("1"),
        costBasisPerUnit: d("100000000.00"),
        interestRatePct: d("4.25"),
        purchasedAt: at("2026-03-01"),
        maturityDate: at("2027-03-01"),
      }),
      inv({
        id: "sbn",
        type: "obligasi",
        quantity: d("50"),
        costBasisPerUnit: d("1000000.00"),
        interestRatePct: d("6.40"),
        purchasedAt: at("2025-06-01"),
      }),
      inv({
        id: "bbca",
        type: "saham",
        ticker: "BBCA",
        transactions: [
          {
            quantity: d("1000"),
            pricePerUnit: d("9250.00"),
            occurredAt: at("2026-05-04"),
          },
        ],
      }),
      inv({
        id: "aapl",
        type: "saham",
        currency: "USD",
        transactions: [
          {
            quantity: d("1"),
            pricePerUnit: d("200.00"),
            occurredAt: at("2026-05-04"),
          },
        ],
      }),
    ]);
    const r = await svc.estimate(FG, 2026, { includeEntries: false });
    expect(
      r.lines.map((l) => [
        l.investmentId,
        l.instrument,
        l.grossAmount,
        l.tax,
        l.caveat,
      ]),
    ).toEqual([
      ["dep", "bunga_deposito", "3563014", "712603", null],
      ["sbn", "kupon_sbn", "3200000", "320000", "assumed_sbn"],
      ["bbca", "saham_idx", "9250000", "9250", null],
    ]);
    expect(r).toMatchObject({
      totalTax: "1041853",
      missingRateCount: 0,
      skippedForeign: 1,
    });
    expect(prisma.investment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ familyGroupId: FG }),
      }),
    );
  });

  // Task 7 carry, opus review fix round 1 (#3) — interestRatePct.times(100)
  // must round half-up explicitly (not rely on Decimal's implicit toFixed
  // rounding mode): 4,255% → 425,5 hundredths → 426, not 425.
  it("rounds a fractional interest rate (4,255%) half-up to 426 hundredths", async () => {
    prisma.investment.findMany.mockResolvedValue([
      inv({
        id: "dep2",
        type: "deposito",
        quantity: d("1"),
        costBasisPerUnit: d("100000000.00"),
        interestRatePct: d("4.255"),
        purchasedAt: at("2026-03-01"),
        maturityDate: at("2027-03-01"),
      }),
    ]);
    const r = await svc.estimate(FG, 2026, { includeEntries: false });
    expect(r.lines.map((l) => [l.grossAmount, l.tax])).toEqual([
      ["3571397", "714279"],
    ]);
  });

  it("splits kripto sells at 2025-08-01 and marks the domestic assumption", async () => {
    prisma.investment.findMany.mockResolvedValue([
      inv({
        id: "btc",
        type: "kripto",
        transactions: [
          {
            quantity: d("0.5"),
            pricePerUnit: d("100000000.00"),
            occurredAt: at("2025-07-31"),
          },
          {
            quantity: d("0.5"),
            pricePerUnit: d("100000000.00"),
            occurredAt: at("2025-08-01"),
          },
        ],
      }),
    ]);
    const r = await svc.estimate(FG, 2025, { includeEntries: false });
    expect(
      r.lines.map((l) => [l.instrument, l.rateBps, l.tax, l.caveat]),
    ).toEqual([
      ["kripto_domestik", 10, "50000", "assumed_domestic"],
      ["kripto_domestik", 21, "105000", "assumed_domestic"],
    ]);
  });

  it("foreign crypto exchange uses 1%; emas sells have no rate", async () => {
    prisma.investment.findMany.mockResolvedValue([
      inv({
        id: "eth",
        type: "kripto",
        cryptoExchange: "luar_negeri",
        transactions: [
          {
            quantity: d("1"),
            pricePerUnit: d("50000000.00"),
            occurredAt: at("2026-02-02"),
          },
        ],
      }),
      inv({
        id: "au",
        type: "emas",
        transactions: [
          {
            quantity: d("10"),
            pricePerUnit: d("1500000.00"),
            occurredAt: at("2026-02-02"),
          },
        ],
      }),
    ]);
    const r = await svc.estimate(FG, 2026, { includeEntries: false });
    expect(r.lines.map((l) => [l.instrument, l.tax, l.rateSource])).toEqual([
      ["kripto_luar", "500000", "rule"],
      ["emas", null, "missing"],
    ]);
    expect(r.missingRateCount).toBe(1);
  });

  it("deposito without an interest rate yields a no_interest_rate line with tax null", async () => {
    prisma.investment.findMany.mockResolvedValue([
      inv({
        id: "dep",
        type: "deposito",
        quantity: d("1"),
        costBasisPerUnit: d("50000000.00"),
      }),
    ]);
    const r = await svc.estimate(FG, 2026, { includeEntries: false });
    expect(r.lines[0]).toMatchObject({
      caveat: "no_interest_rate",
      tax: null,
      grossAmount: "0",
    });
  });

  it("adds manual entries: dividen 10% (0% reinvested), P2P with override", async () => {
    prisma.investment.findMany.mockResolvedValue([]);
    prisma.taxFinalIncomeEntry.findMany.mockResolvedValue([
      {
        id: "e1",
        taxYear: 2026,
        instrument: "dividen",
        grossAmount: 2_000_000n,
        occurredAt: at("2026-05-04"),
        reinvested: false,
        rateBpsOverride: null,
        investmentId: null,
        accountId: null,
        notes: "BBRI",
      },
      {
        id: "e2",
        taxYear: 2026,
        instrument: "dividen",
        grossAmount: 2_000_000n,
        occurredAt: at("2026-05-04"),
        reinvested: true,
        rateBpsOverride: null,
        investmentId: null,
        accountId: null,
        notes: null,
      },
      {
        id: "e3",
        taxYear: 2026,
        instrument: "p2p",
        grossAmount: 1_000_000n,
        occurredAt: at("2026-06-01"),
        reinvested: false,
        rateBpsOverride: 1500,
        investmentId: null,
        accountId: null,
        notes: null,
      },
    ]);
    const r = await svc.estimate(FG, 2026, { includeEntries: true });
    expect(r.lines.map((l) => [l.entryId, l.tax, l.rateSource])).toEqual([
      ["e1", "200000", "rule"],
      ["e2", "0", "rule"],
      ["e3", "150000", "override"],
    ]);
    expect(r.totalTax).toBe("350000");
  });

  // Opus review fix round 1 (Important #2) — a manual entry that overrides a
  // holding's own instrument (same investmentId + instrument) must replace
  // the derived holding line, not add to it.
  it("a manual entry for the same (investmentId, instrument) as a holding replaces it — manual wins", async () => {
    prisma.investment.findMany.mockResolvedValue([
      inv({
        id: "dep",
        type: "deposito",
        quantity: d("1"),
        costBasisPerUnit: d("100000000.00"),
        interestRatePct: d("4.25"),
        purchasedAt: at("2026-03-01"),
        maturityDate: at("2027-03-01"),
      }),
    ]);
    prisma.taxFinalIncomeEntry.findMany.mockResolvedValue([
      {
        id: "e-dep",
        taxYear: 2026,
        instrument: "bunga_deposito",
        grossAmount: 5_000_000n,
        occurredAt: at("2026-06-01"),
        reinvested: false,
        rateBpsOverride: null,
        investmentId: "dep",
        accountId: null,
        notes: "manual override of the holding estimate",
      },
    ]);
    const r = await svc.estimate(FG, 2026, { includeEntries: true });
    expect(r.lines.map((l) => [l.source, l.investmentId, l.tax])).toEqual([
      ["entry", "dep", "1000000"],
    ]);
    expect(r.totalTax).toBe("1000000");
  });
});

describe("FinalTaxService entries", () => {
  const svc = new FinalTaxService(prisma as never);
  beforeEach(() => jest.resetAllMocks());

  it("rejects an investmentId from another family", async () => {
    prisma.investment.findFirst.mockResolvedValue(null);
    await expect(
      svc.createEntry(FG, {
        instrument: "dividen",
        grossAmount: "1",
        occurredAt: "2026-01-02",
        investmentId: "other",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.investment.findFirst).toHaveBeenCalledWith({
      where: { id: "other", familyGroupId: FG },
      select: { id: true },
    });
  });

  it("rejects reinvested on a non-dividend instrument", async () => {
    await expect(
      svc.createEntry(FG, {
        instrument: "sewa",
        grossAmount: "1",
        occurredAt: "2026-01-02",
        reinvested: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("derives taxYear from the WIB date and stores WIB midnight", async () => {
    prisma.taxFinalIncomeEntry.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: "n",
        ...data,
        reinvested: data.reinvested ?? false,
        rateBpsOverride: data.rateBpsOverride ?? null,
        investmentId: null,
        accountId: null,
        notes: null,
      }),
    );
    const r = await svc.createEntry(FG, {
      instrument: "sewa",
      grossAmount: "60000000",
      occurredAt: "2026-01-01",
    });
    expect(prisma.taxFinalIncomeEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        familyGroupId: FG,
        taxYear: 2026,
        occurredAt: new Date("2025-12-31T17:00:00.000Z"),
        grossAmount: 60_000_000n,
      }),
    });
    expect(r.occurredAt).toBe("2026-01-01");
  });

  it("update/delete are scoped to the family (404 otherwise)", async () => {
    prisma.taxFinalIncomeEntry.findFirst.mockResolvedValue(null);
    await expect(svc.removeEntry(FG, "x")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.taxFinalIncomeEntry.findFirst).toHaveBeenCalledWith({
      where: { id: "x", familyGroupId: FG },
    });
  });

  it("setCryptoExchange only for this family's kripto holdings", async () => {
    prisma.investment.findFirst.mockResolvedValue({ id: "s", type: "saham" });
    await expect(
      svc.setCryptoExchange(FG, "s", "luar_negeri"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
