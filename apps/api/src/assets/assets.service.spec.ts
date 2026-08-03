import { Test, type TestingModule } from "@nestjs/testing";
import { Decimal } from "@prisma/client/runtime/library";

import { PrismaService } from "../prisma/prisma.service";

import { AssetsService, computeEstimatedValue } from "./assets.service";

const FAMILY_GROUP_ID = "fg-1";
const ASSET_ID = "asset-1";
const CATEGORY_ID = "cat-1";

function makePrisma() {
  return {
    asset: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    assetHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    category: {
      findFirst: jest.fn(),
    },
  };
}

describe("computeEstimatedValue (pro-rata math)", () => {
  const ONE_YEAR_AGO = new Date("2025-01-01T00:00:00.000Z");
  const NOW = new Date("2026-01-01T00:00:00.000Z"); // ~1 year later

  it("returns currentValue unchanged when rate is null", () => {
    const result = computeEstimatedValue(1_000_000n, null, ONE_YEAR_AGO, NOW);
    expect(result).toBe(1_000_000n);
  });

  it("returns currentValue unchanged when rate is zero", () => {
    const result = computeEstimatedValue(
      1_000_000n,
      new Decimal(0),
      ONE_YEAR_AGO,
      NOW,
    );
    expect(result).toBe(1_000_000n);
  });

  it("appreciates pro-rata for a positive rate over one year", () => {
    // +10%/yr over ~1 year (365 days vs the 365.25-day average year used by
    // the implementation, hence the small ~0.07% slack) → ~1,100,000
    const result = computeEstimatedValue(
      1_000_000n,
      new Decimal("10"),
      ONE_YEAR_AGO,
      NOW,
    );
    expect(Number(result)).toBeCloseTo(1_100_000, -3);
  });

  it("depreciates pro-rata for a negative rate over one year", () => {
    // -10%/yr over ~1 year → ~900,000 (same day-count slack as above)
    const result = computeEstimatedValue(
      1_000_000n,
      new Decimal("-10"),
      ONE_YEAR_AGO,
      NOW,
    );
    expect(Number(result)).toBeCloseTo(900_000, -3);
  });

  it("scales pro-rata for partial-year elapsed time", () => {
    // -20%/yr over exactly half a year → ~-10% → ~900,000
    const sixMonthsAgo = new Date("2025-07-03T00:00:00.000Z");
    const result = computeEstimatedValue(
      1_000_000n,
      new Decimal("-20"),
      sixMonthsAgo,
      NOW,
    );
    expect(Number(result)).toBeCloseTo(900_000, -3);
  });

  it("floors the estimate at 0 for a steep depreciation rate over a long period", () => {
    const tenYearsAgo = new Date("2016-01-01T00:00:00.000Z");
    const result = computeEstimatedValue(
      1_000_000n,
      new Decimal("-100"),
      tenYearsAgo,
      NOW,
    );
    expect(result).toBe(0n);
    expect(result >= 0n).toBe(true);
  });

  it("never returns a negative value even for extreme depreciation", () => {
    const farPast = new Date("2000-01-01T00:00:00.000Z");
    const result = computeEstimatedValue(
      1_000_000n,
      new Decimal("-50"),
      farPast,
      NOW,
    );
    expect(result >= 0n).toBe(true);
  });
});

describe("AssetsService", () => {
  let service: AssetsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [AssetsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AssetsService);
  });

  describe("create — valueChangeRatePct bounds", () => {
    it("accepts a rate within -100..100", async () => {
      prisma.asset.create.mockResolvedValue({
        id: ASSET_ID,
        familyGroupId: FAMILY_GROUP_ID,
        name: "Rumah",
        type: "properti",
        currentValue: 1_000_000_000n,
        currency: "IDR",
        notes: null,
        valueChangeRatePct: new Decimal("5"),
        categoryId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.create(FAMILY_GROUP_ID, {
          name: "Rumah",
          type: "properti",
          currentValue: "1000000000",
          valueChangeRatePct: "5",
        }),
      ).resolves.toBeDefined();
    });

    it("rejects a rate above 100", async () => {
      await expect(
        service.create(FAMILY_GROUP_ID, {
          name: "Rumah",
          type: "properti",
          currentValue: "1000000000",
          valueChangeRatePct: "150",
        }),
      ).rejects.toThrow();
      expect(prisma.asset.create).not.toHaveBeenCalled();
    });

    it("rejects a rate below -100", async () => {
      await expect(
        service.create(FAMILY_GROUP_ID, {
          name: "Mobil",
          type: "kendaraan",
          currentValue: "500000000",
          valueChangeRatePct: "-150",
        }),
      ).rejects.toThrow();
      expect(prisma.asset.create).not.toHaveBeenCalled();
    });
  });

  describe("create/update — categoryId tenant scope", () => {
    it("accepts a categoryId that belongs to the same family group", async () => {
      prisma.category.findFirst.mockResolvedValue({ id: CATEGORY_ID });
      prisma.asset.create.mockResolvedValue({
        id: ASSET_ID,
        familyGroupId: FAMILY_GROUP_ID,
        name: "Rumah",
        type: "properti",
        currentValue: 1_000_000_000n,
        currency: "IDR",
        notes: null,
        valueChangeRatePct: null,
        categoryId: CATEGORY_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.create(FAMILY_GROUP_ID, {
        name: "Rumah",
        type: "properti",
        currentValue: "1000000000",
        categoryId: CATEGORY_ID,
      });

      expect(prisma.category.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CATEGORY_ID, familyGroupId: FAMILY_GROUP_ID },
        }),
      );
      expect(prisma.asset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ categoryId: CATEGORY_ID }),
        }),
      );
    });

    it("rejects a categoryId that belongs to another family group", async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(
        service.create(FAMILY_GROUP_ID, {
          name: "Rumah",
          type: "properti",
          currentValue: "1000000000",
          categoryId: "cat-from-another-tenant",
        }),
      ).rejects.toThrow();
      expect(prisma.asset.create).not.toHaveBeenCalled();
    });

    it("update rejects a categoryId that belongs to another family group", async () => {
      prisma.asset.findUnique.mockResolvedValue({
        id: ASSET_ID,
        familyGroupId: FAMILY_GROUP_ID,
        name: "Rumah",
        type: "properti",
        currentValue: 1_000_000_000n,
        currency: "IDR",
        notes: null,
        valueChangeRatePct: null,
        categoryId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(
        service.update(FAMILY_GROUP_ID, ASSET_ID, {
          categoryId: "cat-from-another-tenant",
        }),
      ).rejects.toThrow();
      expect(prisma.asset.update).not.toHaveBeenCalled();
    });
  });

  describe("findAll — DTO shape includes computed fields", () => {
    it("exposes valueChangeRatePct, categoryId, and currentEstimatedValue", async () => {
      prisma.asset.findMany.mockResolvedValue([
        {
          id: ASSET_ID,
          familyGroupId: FAMILY_GROUP_ID,
          name: "Mobil",
          type: "kendaraan",
          currentValue: 200_000_000n,
          currency: "IDR",
          notes: null,
          valueChangeRatePct: new Decimal("-10"),
          categoryId: CATEGORY_ID,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const [result] = await service.findAll(FAMILY_GROUP_ID);

      expect(result?.valueChangeRatePct).toBe("-10");
      expect(result?.categoryId).toBe(CATEGORY_ID);
      expect(result?.currentEstimatedValue).toBeDefined();
    });
  });
});
