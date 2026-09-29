import { BadRequestException, ConflictException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
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
  // EPIC-022 D2 — buy/sell history. `groupBy` defaults to "no sells yet"
  // so every pre-existing findAll()-based test above keeps passing
  // unmodified (realizedPnlRp: null everywhere, not a fabricated "0").
  investmentTransaction: {
    groupBy: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    findMany: jest.fn(),
    // EPIC-022 D2 retry (HIGH) — remove() guard: defaults to "no history"
    // so every pre-existing remove()-adjacent test keeps passing.
    count: jest.fn().mockResolvedValue(0),
  },
  // EPIC-033 p28 — settlement against a real account.
  account: { findUnique: jest.fn(), update: jest.fn() },
  transaction: { create: jest.fn() },
  category: { findFirst: jest.fn() },
  $transaction: jest.fn(
    async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma),
  ),
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
              // B6 — a REAL feed source here, deliberately not "mock": this
              // test asserts the aggregation formula, not the B6 "never
              // trust a simulated price" fallback (see its own describe
              // block below).
              source: "yahoo-finance",
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
              source: "yahoo-finance",
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

  // ──────────────────────────────────────────────────────────────
  // E2E round-2 B1: ticker required only for saham/kripto
  // ──────────────────────────────────────────────────────────────

  describe("create() — ticker requirement per type", () => {
    it("creates a deposito without a ticker, deriving an internal code", async () => {
      mockPrisma.investment.create.mockImplementation(
        (args: { data: { ticker: string } }) =>
          Promise.resolve({
            id: "inv-1",
            familyGroupId: "fg-1",
            ticker: args.data.ticker,
            name: "Deposito BRI 12 bulan",
            type: "deposito",
            quantity: new Decimal("1"),
            costBasisPerUnit: new Decimal("10000000"),
            currency: "IDR",
            notes: null,
            interestRatePct: new Decimal("5.5"),
            purchasedAt: null,
            maturityDate: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
      );

      const result = await service.create("fg-1", {
        name: "Deposito BRI 12 bulan",
        type: "deposito",
        quantity: "1",
        costBasisPerUnit: "10000000",
        interestRatePct: "5.5",
      });

      expect(mockPrisma.investment.create).toHaveBeenCalled();
      expect(result.ticker).toBeTruthy();
      expect(result.ticker).toMatch(/^[A-Z0-9._-]{1,20}$/i);
    });

    it("rejects saham without a ticker, in Indonesian", async () => {
      await expect(
        service.create("fg-1", {
          name: "Bank Central Asia",
          type: "saham",
          quantity: "100",
          costBasisPerUnit: "9500",
        }),
      ).rejects.toThrow(/Ticker wajib diisi/);
      expect(mockPrisma.investment.create).not.toHaveBeenCalled();
    });

    it("rejects kripto without a ticker", async () => {
      await expect(
        service.create("fg-1", {
          name: "Bitcoin",
          type: "kripto",
          quantity: "0.5",
          costBasisPerUnit: "900000000",
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.investment.create).not.toHaveBeenCalled();
    });

    it("still accepts an explicit ticker for saham", async () => {
      mockPrisma.investment.create.mockResolvedValue({
        id: "inv-1",
        familyGroupId: "fg-1",
        ticker: "BBCA",
        name: "Bank Central Asia",
        type: "saham",
        quantity: new Decimal("100"),
        costBasisPerUnit: new Decimal("9500"),
        currency: "IDR",
        notes: null,
        interestRatePct: null,
        purchasedAt: null,
        maturityDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create("fg-1", {
        ticker: "BBCA",
        name: "Bank Central Asia",
        type: "saham",
        quantity: "100",
        costBasisPerUnit: "9500",
      });

      expect(result.ticker).toBe("BBCA");
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

  // fix-round1 — the create() ticker-requirement guard is trivially
  // bypassed by creating as a non-market type then PATCHing `type` to
  // saham/kripto unless update() re-checks the SAME rule.
  describe("update() — ticker requirement per type (fix-round1)", () => {
    const depositoNoTicker = {
      id: "inv-1",
      familyGroupId: "fg-1",
      ticker: "DEPOSITOBRI",
      name: "Deposito BRI 12 bulan",
      type: "deposito",
      quantity: new Decimal("1"),
      costBasisPerUnit: new Decimal("10000000"),
      currency: "IDR",
      notes: null,
      interestRatePct: new Decimal("5.5"),
      purchasedAt: null,
      maturityDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("rejects a PATCH that changes type to saham without a real ticker, in Indonesian", async () => {
      mockPrisma.investment.findUnique.mockResolvedValue(depositoNoTicker);

      await expect(
        service.update("fg-1", "inv-1", { type: "saham" }),
      ).rejects.toThrow(/Ticker wajib diisi/);
      expect(mockPrisma.investment.update).not.toHaveBeenCalled();
    });

    it("rejects a PATCH that changes type to kripto without a real ticker", async () => {
      mockPrisma.investment.findUnique.mockResolvedValue(depositoNoTicker);

      await expect(
        service.update("fg-1", "inv-1", { type: "kripto" }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.investment.update).not.toHaveBeenCalled();
    });

    it("accepts a PATCH to saham when the ticker is provided in the same request", async () => {
      mockPrisma.investment.findUnique.mockResolvedValue(depositoNoTicker);
      mockPrisma.investment.update.mockResolvedValue({
        ...depositoNoTicker,
        ticker: "BBCA",
        type: "saham",
      });

      const result = await service.update("fg-1", "inv-1", {
        type: "saham",
        ticker: "BBCA",
      });

      expect(result.ticker).toBe("BBCA");
      expect(mockPrisma.investment.update).toHaveBeenCalled();
    });

    it("changing saham -> deposito keeps the existing ticker unchanged", async () => {
      const saham = {
        ...depositoNoTicker,
        ticker: "BBCA",
        type: "saham",
      };
      mockPrisma.investment.findUnique.mockResolvedValue(saham);
      mockPrisma.investment.update.mockResolvedValue({
        ...saham,
        type: "deposito",
      });

      const result = await service.update("fg-1", "inv-1", {
        type: "deposito",
      });

      expect(result.ticker).toBe("BBCA");
      expect(mockPrisma.investment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ticker: "BBCA" }),
        }),
      );
    });

    it("a saham already stored with a ticker is untouched by an unrelated PATCH", async () => {
      const saham = { ...depositoNoTicker, ticker: "BBCA", type: "saham" };
      mockPrisma.investment.findUnique.mockResolvedValue(saham);
      mockPrisma.investment.update.mockResolvedValue(saham);

      await expect(
        service.update("fg-1", "inv-1", { notes: "cek" }),
      ).resolves.toBeDefined();
      expect(mockPrisma.investment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ticker: "BBCA" }),
        }),
      );
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

  // Batch B6 (client revision round 2) — MockMarketDataAdapter fabricates a
  // deterministic-but-fake price for ANY ticker (dev/demo, no
  // USE_REAL_MARKET_DATA). A real holding must never be valued off that:
  // never trust a "mock"-sourced price as if it were live.
  describe("findAll() — B6: never trusts a simulated (mock) price for a real holding", () => {
    it("falls back to cost basis and nulls currentPrice when the latest price is mock-sourced", async () => {
      const recordedAt = new Date(Date.now() + 1000); // "fresh today" so no refetch is attempted
      mockPrisma.investment.findMany.mockResolvedValue([
        {
          id: "inv-qq",
          familyGroupId: "fg-1",
          ticker: "QQ",
          name: "QQ Corp",
          type: "saham",
          quantity: new Decimal("200"),
          costBasisPerUnit: new Decimal("3400"),
          currency: "IDR",
          notes: null,
          interestRatePct: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          prices: [
            {
              id: "p-mock",
              investmentId: "inv-qq",
              price: new Decimal("3092"),
              source: "mock",
              asOf: recordedAt,
              delayed: false,
              recordedAt,
            },
          ],
        },
      ]);

      const [result] = await service.findAll("fg-1");

      // Never the fabricated Rp 3.092 × 200 = Rp 618.400 — cost basis instead.
      expect(result?.currentPrice).toBeNull();
      expect(result?.currentValue).toBe("680000"); // 3400 * 200, the real cost basis
      expect(result?.automatedPriceSimulated).toBe(true);
      expect(result?.automatedPriceUnmapped).toBe(false);
    });

    it("still shows a real automated price (coingecko/yahoo) with automatedPriceSimulated:false", async () => {
      mockMarketData.getPrice.mockResolvedValue({
        price: 950_000_000,
        source: "coingecko",
        asOf: new Date(),
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
        asOf: new Date(),
        delayed: false,
        recordedAt: new Date(),
      });

      const [result] = await service.findAll("fg-1");

      expect(result?.automatedPriceSimulated).toBe(false);
      expect(result?.currentPrice).toBe("950000000");
    });
  });

  describe("findAll() — emas valued from the family gold price (Revisi D item 11)", () => {
    const GOLD_UPDATED_AT = new Date("2026-09-20T03:00:00.000Z");
    const MANUAL_AT = new Date("2026-09-01T03:00:00.000Z");
    const MANUAL_PRICE = {
      id: "p-manual",
      investmentId: "inv-emas",
      price: new Decimal("1300000"),
      source: "manual",
      asOf: MANUAL_AT,
      delayed: false,
      recordedAt: MANUAL_AT,
    };

    function emasRow(overrides: Record<string, unknown> = {}) {
      return {
        id: "inv-emas",
        familyGroupId: "fg-1",
        ticker: "ANTM",
        name: "Logam Mulia",
        type: "emas",
        quantity: new Decimal("10.5"),
        costBasisPerUnit: new Decimal("1200000"),
        currency: "IDR",
        notes: null,
        interestRatePct: null,
        purchasedAt: null,
        maturityDate: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        prices: [MANUAL_PRICE],
        familyGroup: {
          goldPricePerGram: BigInt(1_500_000),
          goldPriceUpdatedAt: GOLD_UPDATED_AT,
        },
        ...overrides,
      };
    }

    it("values emas at quantity × family gold price and labels the source", async () => {
      mockPrisma.investment.findMany.mockResolvedValue([emasRow()]);

      const [result] = await service.findAll("fg-1");

      expect(result?.currentPrice).toBe("1500000");
      expect(result?.currentValue).toBe("15750000");
      expect(result?.returnRp).toBe("3150000");
      expect(result?.returnPct).toBe(25);
      expect(result?.latestPriceSource).toBe("family-gold-price");
      expect(result?.latestPriceAsOf).toBe(GOLD_UPDATED_AT.toISOString());
      expect(result?.latestPriceRecordedAt).toBe(GOLD_UPDATED_AT.toISOString());
      expect(result?.latestPriceDelayed).toBe(false);
      expect(mockMarketData.getPrice).not.toHaveBeenCalled();
      expect(mockPrisma.investmentPrice.create).not.toHaveBeenCalled();
    });

    it("reads the gold price through the familyGroup relation (no extra query)", async () => {
      mockPrisma.investment.findMany.mockResolvedValue([]);

      await service.findAll("fg-1");

      expect(mockPrisma.investment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            familyGroup: {
              select: { goldPricePerGram: true, goldPriceUpdatedAt: true },
            },
          }),
        }),
      );
    });

    it("falls back to the last manual price when the family gold price is unset", async () => {
      mockPrisma.investment.findMany.mockResolvedValue([
        emasRow({
          familyGroup: { goldPricePerGram: null, goldPriceUpdatedAt: null },
        }),
      ]);

      const [result] = await service.findAll("fg-1");

      expect(result?.currentPrice).toBe("1300000");
      expect(result?.currentValue).toBe("13650000");
      expect(result?.latestPriceSource).toBe("manual");
    });

    it("treats a zero family gold price as unset", async () => {
      mockPrisma.investment.findMany.mockResolvedValue([
        emasRow({
          familyGroup: {
            goldPricePerGram: BigInt(0),
            goldPriceUpdatedAt: GOLD_UPDATED_AT,
          },
        }),
      ]);

      const [result] = await service.findAll("fg-1");

      expect(result?.currentPrice).toBe("1300000");
    });

    it.each([null, BigInt(0)])(
      "falls back to cost basis when family gold price is %s and no stored price exists",
      async (goldPricePerGram) => {
        mockPrisma.investment.findMany.mockResolvedValue([
          emasRow({
            prices: [],
            familyGroup: {
              goldPricePerGram,
              goldPriceUpdatedAt:
                goldPricePerGram === null ? null : GOLD_UPDATED_AT,
            },
          }),
        ]);

        const [result] = await service.findAll("fg-1");

        expect(result?.currentPrice).toBe("1200000");
        expect(result?.currentValue).toBe("12600000");
        expect(result?.returnRp).toBe("0");
        expect(result?.returnPct).toBe(0);
        expect(result?.latestPriceSource).toBeNull();
      },
    );

    it("never applies the family gold price to a non-emas holding", async () => {
      mockPrisma.investment.findMany.mockResolvedValue([
        emasRow({ type: "lainnya" }),
      ]);

      const [result] = await service.findAll("fg-1");

      expect(result?.currentPrice).toBe("1300000");
      expect(result?.latestPriceSource).toBe("manual");
    });

    it("getSummary totals the gold-priced value", async () => {
      mockPrisma.investment.findMany.mockResolvedValue([emasRow()]);

      const summary = await service.getSummary("fg-1");

      expect(summary.totalCurrentValue).toBe("15750000");
      expect(summary.totalCostBasis).toBe("12600000");
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

    // Hardening audit (validation, HIGH) — a negative price used to be
    // accepted and persisted unchecked, corrupting the holding's valuation.
    it("rejects a negative price before touching the database", async () => {
      mockPrisma.investment.findUnique.mockResolvedValue({ id: "inv-1" });

      await expect(
        service.setManualPrice("fg-1", "inv-1", { price: "-15250" }),
      ).rejects.toThrow("price must be greater than 0");
      expect(mockPrisma.investmentPrice.create).not.toHaveBeenCalled();
    });

    it("rejects a zero price", async () => {
      mockPrisma.investment.findUnique.mockResolvedValue({ id: "inv-1" });

      await expect(
        service.setManualPrice("fg-1", "inv-1", { price: "0" }),
      ).rejects.toThrow("price must be greater than 0");
      expect(mockPrisma.investmentPrice.create).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────
  // EPIC-022 D2 — buy/sell replaces the silent whole-record overwrite.
  // Test-first, hand-computed golden values (Definition of Done — money
  // math).
  // ──────────────────────────────────────────────────────────────

  describe("recordTransaction() — buy: weighted-average cost", () => {
    it("GOLDEN VALUE: 10 units @ 9.500 + buy 10 units @ 10.500 → qty 20 @ avg 10.000", async () => {
      // Hand computation: (10×9500 + 10×10500) / 20 = (95000+105000)/20
      // = 200000/20 = 10000.
      mockPrisma.investment.findUnique.mockResolvedValue({
        id: "inv-1",
        familyGroupId: "fg-1",
        ticker: "BBCA",
        quantity: new Decimal("10"),
        costBasisPerUnit: new Decimal("9500"),
      });
      mockPrisma.investmentTransaction.create.mockResolvedValue({
        id: "tx-1",
        investmentId: "inv-1",
        type: "buy",
        quantity: new Decimal("10"),
        pricePerUnit: new Decimal("10500"),
        occurredAt: new Date("2026-08-01T00:00:00.000Z"),
        realizedPnl: null,
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
      });

      const result = await service.recordTransaction("fg-1", "inv-1", {
        type: "buy",
        quantity: "10",
        pricePerUnit: "10500",
        occurredAt: "2026-08-01T00:00:00.000Z",
      });

      expect(mockPrisma.investment.update).toHaveBeenCalledTimes(1);
      const updateCall = mockPrisma.investment.update.mock.calls[0]?.[0] as {
        where: { id: string; familyGroupId: string };
        data: { quantity: Decimal; costBasisPerUnit: Decimal };
      };
      expect(updateCall.where).toEqual({ id: "inv-1", familyGroupId: "fg-1" });
      expect(updateCall.data.quantity.toString()).toBe("20");
      expect(updateCall.data.costBasisPerUnit.toString()).toBe("10000");
      expect(result.realizedPnl).toBeNull();
    });
  });

  describe("recordTransaction() — settlement account (EPIC-033 p28)", () => {
    it("buy with accountId debits the account and books a transfer out", async () => {
      mockPrisma.investment.findUnique.mockResolvedValue({
        id: "inv-1",
        familyGroupId: "fg-1",
        ticker: "TSTY",
        quantity: new Decimal("1"),
        costBasisPerUnit: new Decimal("10000"),
      });
      mockPrisma.account.findUnique.mockResolvedValue({
        id: "acc-1",
        familyGroupId: "fg-1",
      });
      mockPrisma.investmentTransaction.create.mockResolvedValue({
        id: "tx-1",
        investmentId: "inv-1",
        type: "buy",
        quantity: new Decimal("100"),
        pricePerUnit: new Decimal("10000"),
        occurredAt: new Date("2026-09-01T00:00:00.000Z"),
        realizedPnl: null,
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
      });

      await service.recordTransaction("fg-1", "inv-1", {
        type: "buy",
        quantity: "100",
        pricePerUnit: "10000",
        accountId: "acc-1",
      });

      expect(mockPrisma.account.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "acc-1" },
          data: { balance: { decrement: 1_000_000n } },
        }),
      );
      expect(mockPrisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "transfer",
            accountId: "acc-1",
            toAccountId: null,
            amount: 1_000_000n,
          }),
        }),
      );
    });

    it("sell with accountId credits the proceeds and books the gain as income", async () => {
      mockPrisma.investment.findUnique.mockResolvedValue({
        id: "inv-1",
        familyGroupId: "fg-1",
        ticker: "TSTY",
        quantity: new Decimal("101"),
        costBasisPerUnit: new Decimal("10000"),
      });
      mockPrisma.account.findUnique.mockResolvedValue({
        id: "acc-1",
        familyGroupId: "fg-1",
      });
      mockPrisma.category.findFirst.mockResolvedValue({ id: "cat-inv" });
      mockPrisma.investmentTransaction.create.mockResolvedValue({
        id: "tx-2",
        investmentId: "inv-1",
        type: "sell",
        quantity: new Decimal("40"),
        pricePerUnit: new Decimal("12500"),
        occurredAt: new Date("2026-09-02T00:00:00.000Z"),
        realizedPnl: new Decimal("100000"),
        createdAt: new Date("2026-09-02T00:00:00.000Z"),
      });

      const result = await service.recordTransaction("fg-1", "inv-1", {
        type: "sell",
        quantity: "40",
        pricePerUnit: "12500",
        accountId: "acc-1",
      });

      expect(result.realizedPnl).toBe("100000");
      expect(mockPrisma.account.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { balance: { increment: 500_000n } },
        }),
      );
      const txCalls = mockPrisma.transaction.create.mock.calls.map(
        (c) => (c[0] as { data: Record<string, unknown> }).data,
      );
      expect(txCalls).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "transfer",
            toAccountId: "acc-1",
            amount: 400_000n,
          }),
          expect.objectContaining({
            type: "income",
            categoryId: "cat-inv",
            amount: 100_000n,
          }),
        ]),
      );
    });
  });

  describe("recordTransaction() — sell: realized P/L + disposal guard", () => {
    it("GOLDEN VALUE: sell 5 of 10 units held @ costBasis 9.500 at 12.000 → realized P/L = 12.500", async () => {
      // Hand computation: (12000 - 9500) × 5 = 2500 × 5 = 12500.
      mockPrisma.investment.findUnique.mockResolvedValue({
        id: "inv-1",
        familyGroupId: "fg-1",
        ticker: "BBCA",
        quantity: new Decimal("10"),
        costBasisPerUnit: new Decimal("9500"),
      });
      mockPrisma.investmentTransaction.create.mockResolvedValue({
        id: "tx-2",
        investmentId: "inv-1",
        type: "sell",
        quantity: new Decimal("5"),
        pricePerUnit: new Decimal("12000"),
        occurredAt: new Date("2026-08-02T00:00:00.000Z"),
        realizedPnl: new Decimal("12500"),
        createdAt: new Date("2026-08-02T00:00:00.000Z"),
      });

      const result = await service.recordTransaction("fg-1", "inv-1", {
        type: "sell",
        quantity: "5",
        pricePerUnit: "12000",
        occurredAt: "2026-08-02T00:00:00.000Z",
      });

      const updateCall = mockPrisma.investment.update.mock.calls[0]?.[0] as {
        data: { quantity: Decimal; costBasisPerUnit: Decimal };
      };
      // Remaining lot keeps the SAME average cost — a sale never reprices
      // what is still held.
      expect(updateCall.data.quantity.toString()).toBe("5");
      expect(updateCall.data.costBasisPerUnit.toString()).toBe("9500");
      expect(result.realizedPnl).toBe("12500");
    });

    it("refuses to sell more than the current quantity (disposal-path guard)", async () => {
      mockPrisma.investment.findUnique.mockResolvedValue({
        id: "inv-1",
        familyGroupId: "fg-1",
        ticker: "BBCA",
        quantity: new Decimal("10"),
        costBasisPerUnit: new Decimal("9500"),
      });

      await expect(
        service.recordTransaction("fg-1", "inv-1", {
          type: "sell",
          quantity: "11",
          pricePerUnit: "12000",
        }),
      ).rejects.toThrow();
      expect(mockPrisma.investmentTransaction.create).not.toHaveBeenCalled();
    });

    it("rejects a non-positive quantity", async () => {
      mockPrisma.investment.findUnique.mockResolvedValue({
        id: "inv-1",
        familyGroupId: "fg-1",
        ticker: "BBCA",
        quantity: new Decimal("10"),
        costBasisPerUnit: new Decimal("9500"),
      });

      await expect(
        service.recordTransaction("fg-1", "inv-1", {
          type: "buy",
          quantity: "0",
          pricePerUnit: "12000",
        }),
      ).rejects.toThrow();
      expect(mockPrisma.investmentTransaction.create).not.toHaveBeenCalled();
    });

    it("throws NotFoundException for an investment outside the family group", async () => {
      mockPrisma.investment.findUnique.mockResolvedValue(null);

      await expect(
        service.recordTransaction("fg-1", "not-mine", {
          type: "buy",
          quantity: "1",
          pricePerUnit: "100",
        }),
      ).rejects.toThrow();
      expect(mockPrisma.investmentTransaction.create).not.toHaveBeenCalled();
    });
  });

  describe("findAll() — realizedPnlRp rollup", () => {
    it("sums realizedPnl across sells for the holding and stays null with no sells", async () => {
      mockPrisma.investment.findMany.mockResolvedValue([
        {
          id: "inv-1",
          familyGroupId: "fg-1",
          ticker: "BBCA",
          name: "Bank BCA",
          type: "saham",
          quantity: new Decimal("5"),
          costBasisPerUnit: new Decimal("9500"),
          currency: "IDR",
          notes: null,
          interestRatePct: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          prices: [],
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
          interestRatePct: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          prices: [],
        },
      ]);
      mockPrisma.investmentTransaction.groupBy.mockResolvedValueOnce([
        { investmentId: "inv-1", _sum: { realizedPnl: new Decimal("12500") } },
      ]);

      const results = await service.findAll("fg-1");

      expect(results.find((r) => r.id === "inv-1")?.realizedPnlRp).toBe(
        "12500",
      );
      expect(results.find((r) => r.id === "inv-2")?.realizedPnlRp).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Review retry (HIGH #1) — quantity/costBasisPerUnit must ONLY change
  // through recordTransaction() for a lot-tracked type; a direct PATCH is
  // the exact "raw, unvalidated overwrite" this epic set out to close.
  // ──────────────────────────────────────────────────────────────

  describe("update() — quantity/costBasisPerUnit lot-tracking guard", () => {
    const sahamInvestment = {
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
    };
    const depositoInvestment = {
      ...sahamInvestment,
      id: "inv-depo",
      type: "deposito",
    };

    it("rejects a direct quantity overwrite for a non-deposito holding, even a negative one", async () => {
      mockPrisma.investment.findUnique.mockResolvedValue(sahamInvestment);

      await expect(
        service.update("fg-1", "inv-saham", { quantity: "-999999" }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.investment.update).not.toHaveBeenCalled();
    });

    it("rejects a direct costBasisPerUnit overwrite for a non-deposito holding", async () => {
      mockPrisma.investment.findUnique.mockResolvedValue(sahamInvestment);

      await expect(
        service.update("fg-1", "inv-saham", { costBasisPerUnit: "1" }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.investment.update).not.toHaveBeenCalled();
    });

    it("still allows editing name/ticker/notes on a non-deposito holding without touching quantity/cost", async () => {
      mockPrisma.investment.findUnique.mockResolvedValue(sahamInvestment);
      mockPrisma.investment.update.mockResolvedValue({
        ...sahamInvestment,
        name: "Bank Central Asia Tbk",
      });

      await expect(
        service.update("fg-1", "inv-saham", { name: "Bank Central Asia Tbk" }),
      ).resolves.toBeDefined();
      expect(mockPrisma.investment.update).toHaveBeenCalled();
    });

    it("allows quantity/costBasisPerUnit edits for deposito (a typo-correctable nominal, not a lot)", async () => {
      mockPrisma.investment.findUnique.mockResolvedValue(depositoInvestment);
      mockPrisma.investment.update.mockResolvedValue({
        ...depositoInvestment,
        costBasisPerUnit: new Decimal("105000000"),
      });

      await expect(
        service.update("fg-1", "inv-depo", { costBasisPerUnit: "105000000" }),
      ).resolves.toBeDefined();
      expect(mockPrisma.investment.update).toHaveBeenCalled();
    });

    it("still rejects a negative quantity/cost for deposito (MEDIUM — sign check applies regardless of type)", async () => {
      mockPrisma.investment.findUnique.mockResolvedValue(depositoInvestment);

      await expect(
        service.update("fg-1", "inv-depo", { quantity: "-1" }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.investment.update).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Review retry (MEDIUM #4) — create() rejects a negative/zero quantity
  // or a negative costBasisPerUnit (class-validator's @IsNumberString()
  // alone accepts a leading "-").
  // ──────────────────────────────────────────────────────────────

  describe("create() — quantity/costBasisPerUnit sign validation", () => {
    it("rejects a non-positive quantity", async () => {
      await expect(
        service.create("fg-1", {
          ticker: "BBCA",
          name: "Bank BCA",
          type: "saham",
          quantity: "0",
          costBasisPerUnit: "9500",
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.investment.create).not.toHaveBeenCalled();
    });

    it("rejects a negative costBasisPerUnit", async () => {
      await expect(
        service.create("fg-1", {
          ticker: "BBCA",
          name: "Bank BCA",
          type: "saham",
          quantity: "10",
          costBasisPerUnit: "-1",
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.investment.create).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Review retry (CRITICAL/HIGH #2) — TOCTOU fix: the current state must
  // be read (and re-read on retry) INSIDE the Serializable transaction,
  // never before it. Mirrors LiabilitiesService.pay()'s own retry test.
  // ──────────────────────────────────────────────────────────────

  describe("recordTransaction() — Serializable retry (TOCTOU fix)", () => {
    it("runs at Serializable isolation and recomputes off the re-read state on a P2034 retry", async () => {
      // Attempt 1 reads qty=10 (and, per real Postgres semantics, its
      // statements DO run against that snapshot); the conflict is only
      // detected at commit. Attempt 2 (the retry) re-reads and sees
      // qty=7 — as if a concurrent sell of 3 units won the race and
      // committed first. The retry's write must reflect 7, not the
      // stale 10 a TOCTOU bug would have used.
      let findUniqueCalls = 0;
      mockPrisma.investment.findUnique.mockImplementation(() => {
        findUniqueCalls += 1;
        return Promise.resolve({
          id: "inv-1",
          familyGroupId: "fg-1",
          ticker: "BBCA",
          quantity: new Decimal(findUniqueCalls === 1 ? "10" : "7"),
          costBasisPerUnit: new Decimal("9500"),
        });
      });
      mockPrisma.investmentTransaction.create.mockResolvedValue({
        id: "tx-3",
        investmentId: "inv-1",
        type: "buy",
        quantity: new Decimal("2"),
        pricePerUnit: new Decimal("10000"),
        occurredAt: new Date("2026-08-03T00:00:00.000Z"),
        realizedPnl: null,
        createdAt: new Date("2026-08-03T00:00:00.000Z"),
      });

      let transactionCalls = 0;
      mockPrisma.$transaction.mockImplementation(
        async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => {
          transactionCalls += 1;
          const result = await cb(mockPrisma);
          if (transactionCalls === 1) {
            throw new Prisma.PrismaClientKnownRequestError("conflict", {
              code: "P2034",
              clientVersion: "test",
            });
          }
          return result;
        },
      );

      const result = await service.recordTransaction("fg-1", "inv-1", {
        type: "buy",
        quantity: "2",
        pricePerUnit: "10000",
        occurredAt: "2026-08-03T00:00:00.000Z",
      });

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
      expect(mockPrisma.$transaction.mock.calls[0]?.[1]).toEqual({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
      expect(mockPrisma.investment.findUnique).toHaveBeenCalledTimes(2);
      // Second (winning) attempt computed off the re-read qty=7 → newQty=9,
      // NOT 12 (which is what a stale qty=10 read would have produced).
      const secondUpdateCall = mockPrisma.investment.update.mock
        .calls[1]?.[0] as { data: { quantity: Decimal } };
      expect(secondUpdateCall.data.quantity.toString()).toBe("9");
      expect(result.id).toBe("tx-3");
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Review retry (HIGH #3) — deleting an Investment must never silently
  // cascade-delete its InvestmentTransaction history (every buy/sell,
  // every realized P/L ever recorded). Mirrors LiabilitiesService.remove().
  // ──────────────────────────────────────────────────────────────

  describe("remove() — refuses deletion while transaction history exists", () => {
    const investment = {
      id: "inv-1",
      familyGroupId: "fg-1",
      name: "Bank BCA",
    };

    it("refuses to delete when InvestmentTransaction rows exist", async () => {
      mockPrisma.investment.findUnique.mockResolvedValue(investment);
      mockPrisma.investmentTransaction.count.mockResolvedValue(2);

      await expect(service.remove("fg-1", "inv-1")).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.investment.delete).not.toHaveBeenCalled();
    });

    it("still deletes when no transaction history exists", async () => {
      mockPrisma.investment.findUnique.mockResolvedValue(investment);
      mockPrisma.investmentTransaction.count.mockResolvedValue(0);
      mockPrisma.investment.delete.mockResolvedValue(investment);

      await expect(service.remove("fg-1", "inv-1")).resolves.toBeUndefined();
      expect(mockPrisma.investment.delete).toHaveBeenCalledWith({
        where: { id: "inv-1", familyGroupId: "fg-1" },
      });
    });
  });
});
