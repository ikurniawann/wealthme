import { Test, type TestingModule } from "@nestjs/testing";
import { Decimal } from "@prisma/client/runtime/library";

import { PrismaService } from "../prisma/prisma.service";

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
});
