import { Test, type TestingModule } from "@nestjs/testing";
import { Decimal } from "@prisma/client/runtime/library";

import { PrismaService } from "../prisma/prisma.service";

import { UnmappedTickerError } from "./coingecko-market-data.adapter";
import { InvestmentsService } from "./investments.service";
import { MARKET_DATA_PORT } from "./market-data.port";

const mockPrisma = {
  investment: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  investmentPrice: {
    create: jest.fn(),
  },
};

const mockMarketData = {
  getPrice: jest.fn(),
};

describe("InvestmentsService P&L", () => {
  let service: InvestmentsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvestmentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MARKET_DATA_PORT, useValue: mockMarketData },
      ],
    }).compile();

    service = module.get<InvestmentsService>(InvestmentsService);
  });

  // ──────────────────────────────────────────────────────────────
  // Pure formula tests (no I/O)
  // ──────────────────────────────────────────────────────────────

  describe("returnRp formula", () => {
    it("calculates positive return correctly", () => {
      // Arrange
      const costBasis = 50_000_000;
      const currentPrice = 62_300_000;
      const quantity = 1;

      // Act
      const returnRp = (currentPrice - costBasis) * quantity;
      const returnPct = (returnRp / (costBasis * quantity)) * 100;

      // Assert
      expect(returnRp).toBe(12_300_000);
      expect(returnPct).toBeCloseTo(24.6, 1);
    });

    it("calculates negative return (loss) correctly", () => {
      // Arrange
      const costBasis = 30_000_000;
      const currentPrice = 28_500_000;
      const quantity = 1;

      // Act
      const returnRp = (currentPrice - costBasis) * quantity;
      const returnPct = (returnRp / (costBasis * quantity)) * 100;

      // Assert
      expect(returnRp).toBe(-1_500_000);
      expect(returnPct).toBeCloseTo(-5.0, 1);
    });

    it("scales linearly with quantity", () => {
      // Arrange
      const costBasis = 10_000;
      const currentPrice = 12_000;
      const quantity = 5;

      // Act
      const returnRp = (currentPrice - costBasis) * quantity;
      const returnPct = (returnRp / (costBasis * quantity)) * 100;

      // Assert
      expect(returnRp).toBe(10_000);
      expect(returnPct).toBeCloseTo(20.0, 1);
    });

    it("returns zero when currentPrice equals costBasis", () => {
      const costBasis = 100_000;
      const returnRp = (costBasis - costBasis) * 1;
      expect(returnRp).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // getSummary — aggregation via findAll (mocked Prisma)
  // ──────────────────────────────────────────────────────────────

  describe("getSummary()", () => {
    it("aggregates totalCurrentValue and totalReturnRp across two holdings", async () => {
      // Arrange — simulate two investments already having a fresh price today
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const priceRecordedAt = new Date(today.getTime() + 1000); // after start of day

      mockPrisma.investment.findMany.mockResolvedValue([
        {
          id: "inv-1",
          familyGroupId: "fg-1",
          ticker: "BBCA",
          name: "Bank BCA",
          type: "saham",
          quantity: new Decimal("10"),
          costBasisPerUnit: new Decimal("9500"),
          currency: "IDR",
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          prices: [
            {
              id: "p-1",
              investmentId: "inv-1",
              price: new Decimal("10000"),
              source: "mock",
              recordedAt: priceRecordedAt,
            },
          ],
        },
        {
          id: "inv-2",
          familyGroupId: "fg-1",
          ticker: "TLKM",
          name: "Telkom",
          type: "saham",
          quantity: new Decimal("20"),
          costBasisPerUnit: new Decimal("4000"),
          currency: "IDR",
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          prices: [
            {
              id: "p-2",
              investmentId: "inv-2",
              price: new Decimal("3800"),
              source: "mock",
              recordedAt: priceRecordedAt,
            },
          ],
        },
      ]);

      // Act
      const summary = await service.getSummary("fg-1");

      // Assert
      // inv-1: currentValue = 10000 * 10 = 100_000, cost = 9500 * 10 = 95_000
      // inv-2: currentValue = 3800 * 20 = 76_000, cost = 4000 * 20 = 80_000
      // totalCurrentValue = 176_000, totalCostBasis = 175_000
      // totalReturnRp = 1_000
      expect(parseFloat(summary.totalCurrentValue)).toBeCloseTo(176_000, 0);
      expect(parseFloat(summary.totalCostBasis)).toBeCloseTo(175_000, 0);
      expect(parseFloat(summary.totalReturnRp)).toBeCloseTo(1_000, 0);
      // returnPct ≈ 1000 / 175000 * 100 ≈ 0.57
      expect(summary.totalReturnPct).toBeCloseTo(0.57, 1);
    });

    it("returns zero totals when no investments exist", async () => {
      // Arrange
      mockPrisma.investment.findMany.mockResolvedValue([]);

      // Act
      const summary = await service.getSummary("fg-empty");

      // Assert
      expect(summary.totalReturnRp).toBe("0");
      expect(summary.totalReturnPct).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // EPIC-021 #20: interestRatePct validation + projectedAnnualYield
  // ──────────────────────────────────────────────────────────────

  describe("create() — interestRatePct bounds", () => {
    it("accepts a rate within 0..100", async () => {
      mockPrisma.investment.create.mockResolvedValue({
        id: "inv-1",
        familyGroupId: "fg-1",
        ticker: "OBLIGASI1",
        name: "Obligasi Negara",
        type: "obligasi",
        quantity: new Decimal("10"),
        costBasisPerUnit: new Decimal("1000000"),
        currency: "IDR",
        notes: null,
        interestRatePct: new Decimal("6.5"),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create("fg-1", {
        ticker: "OBLIGASI1",
        name: "Obligasi Negara",
        type: "obligasi",
        quantity: "10",
        costBasisPerUnit: "1000000",
        interestRatePct: "6.5",
      });

      expect(result.interestRatePct).toBe("6.5");
    });

    it("rejects a rate above 100", async () => {
      await expect(
        service.create("fg-1", {
          ticker: "OBLIGASI1",
          name: "Obligasi Negara",
          type: "obligasi",
          quantity: "10",
          costBasisPerUnit: "1000000",
          interestRatePct: "150",
        }),
      ).rejects.toThrow();
      expect(mockPrisma.investment.create).not.toHaveBeenCalled();
    });

    it("rejects a negative rate", async () => {
      await expect(
        service.create("fg-1", {
          ticker: "OBLIGASI1",
          name: "Obligasi Negara",
          type: "obligasi",
          quantity: "10",
          costBasisPerUnit: "1000000",
          interestRatePct: "-5",
        }),
      ).rejects.toThrow();
      expect(mockPrisma.investment.create).not.toHaveBeenCalled();
    });
  });

  describe("update() — interestRatePct bounds", () => {
    const existingInvestment = {
      id: "inv-1",
      familyGroupId: "fg-1",
      ticker: "OBLIGASI1",
      name: "Obligasi Negara",
      type: "obligasi",
      quantity: new Decimal("10"),
      costBasisPerUnit: new Decimal("1000000"),
      currency: "IDR",
      notes: null,
      interestRatePct: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("accepts a rate within 0..100 on update", async () => {
      mockPrisma.investment.findUnique.mockResolvedValue(existingInvestment);
      mockPrisma.investment.update.mockResolvedValue({
        ...existingInvestment,
        interestRatePct: new Decimal("8"),
      });

      await expect(
        service.update("fg-1", "inv-1", { interestRatePct: "8" }),
      ).resolves.toBeDefined();
      expect(mockPrisma.investment.update).toHaveBeenCalled();
    });

    it("rejects a rate above 100 on update", async () => {
      mockPrisma.investment.findUnique.mockResolvedValue(existingInvestment);

      await expect(
        service.update("fg-1", "inv-1", { interestRatePct: "150" }),
      ).rejects.toThrow();
      expect(mockPrisma.investment.update).not.toHaveBeenCalled();
    });

    it("rejects a negative rate on update", async () => {
      mockPrisma.investment.findUnique.mockResolvedValue(existingInvestment);

      await expect(
        service.update("fg-1", "inv-1", { interestRatePct: "-5" }),
      ).rejects.toThrow();
      expect(mockPrisma.investment.update).not.toHaveBeenCalled();
    });
  });

  describe("findAll() — projectedAnnualYield + latest price provenance", () => {
    it("computes projectedAnnualYield as currentValue × interestRatePct / 100", async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const recordedAt = new Date(today.getTime() + 1000);

      mockPrisma.investment.findMany.mockResolvedValue([
        {
          id: "inv-1",
          familyGroupId: "fg-1",
          ticker: "OBLIGASI1",
          name: "Obligasi Negara",
          type: "obligasi",
          quantity: new Decimal("10"),
          costBasisPerUnit: new Decimal("1000000"),
          currency: "IDR",
          notes: null,
          interestRatePct: new Decimal("6"),
          createdAt: new Date(),
          updatedAt: new Date(),
          prices: [
            {
              id: "p-1",
              investmentId: "inv-1",
              price: new Decimal("1000000"),
              source: "mock",
              recordedAt,
            },
          ],
        },
      ]);

      const [result] = await service.findAll("fg-1");

      // currentValue = 1_000_000 * 10 = 10_000_000; yield = 10_000_000 * 6/100 = 600_000
      expect(result?.currentValue).toBe("10000000");
      expect(parseFloat(result?.projectedAnnualYield ?? "0")).toBeCloseTo(
        600_000,
        0,
      );
      expect(result?.latestPriceRecordedAt).toBe(recordedAt.toISOString());
      expect(result?.latestPriceSource).toBe("mock");
    });

    it("returns null projectedAnnualYield when interestRatePct is not set", async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const recordedAt = new Date(today.getTime() + 1000);

      mockPrisma.investment.findMany.mockResolvedValue([
        {
          id: "inv-2",
          familyGroupId: "fg-1",
          ticker: "BBCA",
          name: "Bank BCA",
          type: "saham",
          quantity: new Decimal("10"),
          costBasisPerUnit: new Decimal("9500"),
          currency: "IDR",
          notes: null,
          interestRatePct: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          prices: [
            {
              id: "p-2",
              investmentId: "inv-2",
              price: new Decimal("10000"),
              source: "mock",
              recordedAt,
            },
          ],
        },
      ]);

      const [result] = await service.findAll("fg-1");

      expect(result?.interestRatePct).toBeNull();
      expect(result?.projectedAnnualYield).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────
  // EPIC-023 G1 (D15): automate what can be automated, label the rest.
  // ──────────────────────────────────────────────────────────────

  describe("findAll() — routing by AUTOMATED_PRICE_TYPES", () => {
    it("fetches an automated quote (kripto) when no price exists yet, storing source/asOf/delayed", async () => {
      const asOf = new Date("2026-08-05T10:00:00.000Z");
      mockMarketData.getPrice.mockResolvedValue({
        price: 950_000_000,
        source: "coingecko",
        asOf,
        delayed: false,
      });
      mockPrisma.investment.findMany.mockResolvedValue([
        {
          id: "inv-btc",
          familyGroupId: "fg-1",
          ticker: "BTC",
          name: "Bitcoin",
          type: "kripto",
          quantity: new Decimal("0.01"),
          costBasisPerUnit: new Decimal("900000000"),
          currency: "IDR",
          notes: null,
          interestRatePct: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          prices: [],
        },
      ]);
      mockPrisma.investmentPrice.create.mockResolvedValue({
        id: "p-btc",
        investmentId: "inv-btc",
        price: new Decimal("950000000"),
        source: "coingecko",
        asOf,
        delayed: false,
        recordedAt: asOf,
      });

      const [result] = await service.findAll("fg-1");

      expect(mockMarketData.getPrice).toHaveBeenCalledWith("BTC", "kripto");
      expect(result?.latestPriceSource).toBe("coingecko");
      expect(result?.latestPriceDelayed).toBe(false);
      expect(result?.latestPriceAsOf).toBe(asOf.toISOString());
    });

    it("never calls MarketDataPort.getPrice for a manual-only type (reksa_dana), even with no price recorded", async () => {
      mockPrisma.investment.findMany.mockResolvedValue([
        {
          id: "inv-rd",
          familyGroupId: "fg-1",
          ticker: "RDPU001",
          name: "Reksa Dana Pasar Uang",
          type: "reksa_dana",
          quantity: new Decimal("1000"),
          costBasisPerUnit: new Decimal("1500"),
          currency: "IDR",
          notes: null,
          interestRatePct: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          prices: [],
        },
      ]);

      const [result] = await service.findAll("fg-1");

      expect(mockMarketData.getPrice).not.toHaveBeenCalled();
      expect(mockPrisma.investmentPrice.create).not.toHaveBeenCalled();
      expect(result?.currentPrice).toBeNull();
      expect(result?.latestPriceSource).toBeNull();
    });

    it("falls back to the last known price instead of throwing when the feed fails", async () => {
      const yesterday = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      mockMarketData.getPrice.mockRejectedValue(new Error("network down"));
      mockPrisma.investment.findMany.mockResolvedValue([
        {
          id: "inv-saham",
          familyGroupId: "fg-1",
          ticker: "BBCA",
          name: "Bank BCA",
          type: "saham",
          quantity: new Decimal("10"),
          costBasisPerUnit: new Decimal("9500"),
          currency: "IDR",
          notes: null,
          interestRatePct: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          prices: [
            {
              id: "p-old",
              investmentId: "inv-saham",
              price: new Decimal("9800"),
              source: "yahoo-finance",
              asOf: yesterday,
              delayed: true,
              recordedAt: yesterday,
            },
          ],
        },
      ]);

      const [result] = await service.findAll("fg-1");

      expect(result?.currentPrice).toBe("9800");
      expect(mockPrisma.investmentPrice.create).not.toHaveBeenCalled();
      // EPIC-023 Task G retry (MEDIUM finding) — a retained (stale) price
      // must be distinguishable from a fresh one: this request DID attempt
      // a refresh and it failed.
      expect(result?.priceRefreshFailed).toBe(true);
    });

    it("reports priceRefreshFailed:false when the feed succeeds", async () => {
      const asOf = new Date("2026-08-05T10:00:00.000Z");
      mockMarketData.getPrice.mockResolvedValue({
        price: 950_000_000,
        source: "coingecko",
        asOf,
        delayed: false,
      });
      mockPrisma.investment.findMany.mockResolvedValue([
        {
          id: "inv-btc",
          familyGroupId: "fg-1",
          ticker: "BTC",
          name: "Bitcoin",
          type: "kripto",
          quantity: new Decimal("0.01"),
          costBasisPerUnit: new Decimal("900000000"),
          currency: "IDR",
          notes: null,
          interestRatePct: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          prices: [],
        },
      ]);
      mockPrisma.investmentPrice.create.mockResolvedValue({
        id: "p-btc",
        investmentId: "inv-btc",
        price: new Decimal("950000000"),
        source: "coingecko",
        asOf,
        delayed: false,
        recordedAt: asOf,
      });

      const [result] = await service.findAll("fg-1");

      expect(result?.priceRefreshFailed).toBe(false);
    });

    // EPIC-024 C1 (D8) — "unknown ticker → manual-price fallback ... must
    // not throw". This is the money assertion: findAll must resolve
    // (never reject) for a kripto holding whose ticker has no CoinGecko
    // mapping, and must label it distinctly from a transient failure.
    it("does NOT throw for a kripto ticker with no CoinGecko mapping — falls back to manual-price labelling", async () => {
      mockMarketData.getPrice.mockRejectedValue(
        new UnmappedTickerError("NOTACOIN"),
      );
      mockPrisma.investment.findMany.mockResolvedValue([
        {
          id: "inv-unmapped",
          familyGroupId: "fg-1",
          ticker: "NOTACOIN",
          name: "Some Obscure Altcoin",
          type: "kripto",
          quantity: new Decimal("100"),
          costBasisPerUnit: new Decimal("500"),
          currency: "IDR",
          notes: null,
          interestRatePct: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          prices: [],
        },
      ]);

      // The key behavioural assertion: this must resolve, not reject.
      await expect(service.findAll("fg-1")).resolves.toHaveLength(1);

      const [result] = await service.findAll("fg-1");
      expect(result?.automatedPriceUnmapped).toBe(true);
      // Distinct from a transient failure — must NOT also flip
      // priceRefreshFailed, which would mislabel a permanent state as a
      // retryable one and mislead the "refresh failed" UI badge.
      expect(result?.priceRefreshFailed).toBe(false);
      expect(result?.currentPrice).toBeNull();
      expect(mockPrisma.investmentPrice.create).not.toHaveBeenCalled();
    });

    it("sets automatedPriceUnmapped:false for a transient (non-mapping) failure", async () => {
      mockMarketData.getPrice.mockRejectedValue(new Error("network down"));
      mockPrisma.investment.findMany.mockResolvedValue([
        {
          id: "inv-btc",
          familyGroupId: "fg-1",
          ticker: "BTC",
          name: "Bitcoin",
          type: "kripto",
          quantity: new Decimal("0.01"),
          costBasisPerUnit: new Decimal("900000000"),
          currency: "IDR",
          notes: null,
          interestRatePct: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          prices: [],
        },
      ]);

      const [result] = await service.findAll("fg-1");

      expect(result?.automatedPriceUnmapped).toBe(false);
      expect(result?.priceRefreshFailed).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // EPIC-024 C3 (D10) — deposito: nominal, bunga %/thn, simple interest,
  // pro-rata + post-maturity. Test-first with hand-computed golden values
  // (Definition of Done requirement for money math).
  // ──────────────────────────────────────────────────────────────

  describe("findAll() — deposito simple-interest valuation", () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it("GOLDEN VALUE: Rp 100.000.000 at 5%/thn started 2026-01-01, viewed 2026-07-01 → Rp 102.500.000 (pro-rata, exactly half a year)", async () => {
      // Arrange — hand computation: months elapsed = 6 (Jan 1 → Jul 1);
      // interest = 100_000_000 × 0.05 × 6/12 = 2_500_000;
      // value = 100_000_000 + 2_500_000 = 102_500_000.
      jest.useFakeTimers().setSystemTime(new Date("2026-07-01T00:00:00.000Z"));
      mockPrisma.investment.findMany.mockResolvedValue([
        {
          id: "inv-deposito",
          familyGroupId: "fg-1",
          ticker: "DEPO-BCA",
          name: "Deposito BCA",
          type: "deposito",
          quantity: new Decimal("1"),
          costBasisPerUnit: new Decimal("100000000"),
          currency: "IDR",
          notes: null,
          interestRatePct: new Decimal("5"),
          purchasedAt: new Date("2026-01-01T00:00:00.000Z"),
          maturityDate: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          prices: [],
        },
      ]);

      const [result] = await service.findAll("fg-1");

      expect(result?.currentValue).toBe("102500000");
      expect(result?.returnRp).toBe("2500000");
      expect(mockMarketData.getPrice).not.toHaveBeenCalled();
      expect(mockPrisma.investmentPrice.create).not.toHaveBeenCalled();
    });

    it("caps accrual at maturityDate — a matured deposito does not keep earning simple interest indefinitely", async () => {
      // Arrange — purchasedAt 2026-01-01, maturityDate 2026-04-01 (3 months
      // of accrual), VIEWED 2026-07-01 (6 months elapsed, but capped at 3):
      // interest = 100_000_000 × 0.05 × 3/12 = 1_250_000 → 101_250_000.
      jest.useFakeTimers().setSystemTime(new Date("2026-07-01T00:00:00.000Z"));
      mockPrisma.investment.findMany.mockResolvedValue([
        {
          id: "inv-deposito-matured",
          familyGroupId: "fg-1",
          ticker: "DEPO-BCA",
          name: "Deposito BCA",
          type: "deposito",
          quantity: new Decimal("1"),
          costBasisPerUnit: new Decimal("100000000"),
          currency: "IDR",
          notes: null,
          interestRatePct: new Decimal("5"),
          purchasedAt: new Date("2026-01-01T00:00:00.000Z"),
          maturityDate: new Date("2026-04-01T00:00:00.000Z"),
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          prices: [],
        },
      ]);

      const [result] = await service.findAll("fg-1");

      expect(result?.currentValue).toBe("101250000");
    });

    it("returns the nominal unchanged when interestRatePct is not set", async () => {
      mockPrisma.investment.findMany.mockResolvedValue([
        {
          id: "inv-deposito-norate",
          familyGroupId: "fg-1",
          ticker: "DEPO-BCA",
          name: "Deposito BCA",
          type: "deposito",
          quantity: new Decimal("1"),
          costBasisPerUnit: new Decimal("50000000"),
          currency: "IDR",
          notes: null,
          interestRatePct: null,
          purchasedAt: new Date("2026-01-01T00:00:00.000Z"),
          maturityDate: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          prices: [],
        },
      ]);

      const [result] = await service.findAll("fg-1");

      expect(result?.currentValue).toBe("50000000");
      expect(result?.returnRp).toBe("0");
    });

    it("returns the nominal unchanged when purchasedAt is not set (no accrual start point)", async () => {
      mockPrisma.investment.findMany.mockResolvedValue([
        {
          id: "inv-deposito-nodate",
          familyGroupId: "fg-1",
          ticker: "DEPO-BCA",
          name: "Deposito BCA",
          type: "deposito",
          quantity: new Decimal("1"),
          costBasisPerUnit: new Decimal("50000000"),
          currency: "IDR",
          notes: null,
          interestRatePct: new Decimal("5"),
          purchasedAt: null,
          maturityDate: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          prices: [],
        },
      ]);

      const [result] = await service.findAll("fg-1");

      expect(result?.currentValue).toBe("50000000");
    });

    it("never calls MarketDataPort.getPrice for deposito — it has no market feed, automated or manual", async () => {
      mockPrisma.investment.findMany.mockResolvedValue([
        {
          id: "inv-deposito",
          familyGroupId: "fg-1",
          ticker: "DEPO-BCA",
          name: "Deposito BCA",
          type: "deposito",
          quantity: new Decimal("1"),
          costBasisPerUnit: new Decimal("100000000"),
          currency: "IDR",
          notes: null,
          interestRatePct: new Decimal("5"),
          purchasedAt: new Date("2026-01-01T00:00:00.000Z"),
          maturityDate: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          prices: [],
        },
      ]);

      await service.findAll("fg-1");

      expect(mockMarketData.getPrice).not.toHaveBeenCalled();
    });
  });

  describe("setManualPrice()", () => {
    it("creates a manual price record with source 'manual' and delayed=false", async () => {
      mockPrisma.investment.findUnique.mockResolvedValue({ id: "inv-1" });
      const asOf = new Date("2026-08-01T00:00:00.000Z");
      mockPrisma.investmentPrice.create.mockResolvedValue({
        id: "price-1",
        investmentId: "inv-1",
        price: new Decimal("15250"),
        source: "manual",
        asOf,
        delayed: false,
        recordedAt: new Date("2026-08-05T00:00:00.000Z"),
      });

      const result = await service.setManualPrice("fg-1", "inv-1", {
        price: "15250",
        asOf: asOf.toISOString(),
      });

      expect(mockPrisma.investmentPrice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          investmentId: "inv-1",
          source: "manual",
          delayed: false,
        }),
      });
      expect(result.source).toBe("manual");
      expect(result.asOf).toBe(asOf.toISOString());
    });

    it("throws NotFoundException for an investment outside the family group", async () => {
      mockPrisma.investment.findUnique.mockResolvedValue(null);

      await expect(
        service.setManualPrice("fg-1", "not-mine", { price: "100" }),
      ).rejects.toThrow();
      expect(mockPrisma.investmentPrice.create).not.toHaveBeenCalled();
    });
  });
});
