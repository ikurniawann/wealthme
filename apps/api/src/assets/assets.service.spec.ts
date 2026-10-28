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

// EPIC-023 D19/US-ASSET-4: a real golden-value test — the expected value is
// hand-computed below from the formula, independent of ever calling
// computeEstimatedValue, so it cannot silently pass by reading back the
// function's own output.
describe("computeEstimatedValue — acquisitionDate golden value (EPIC-023 D19)", () => {
  it("2,000,000 at +15%/yr over exactly 3 years (from acquisitionDate) → 2,900,000", () => {
    const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
    const NOW = new Date("2026-01-01T00:00:00.000Z");
    // `since` is constructed to be exactly 3 × MS_PER_YEAR before `now`, so
    // yearsElapsed inside the function is exactly 3 — no calendar slack.
    const acquisitionDate = new Date(NOW.getTime() - 3 * MS_PER_YEAR);

    // Hand computation (matches computeEstimatedValue's documented formula,
    // computed here independently of the function under test):
    //   yearsElapsed = 3                          (exact, by construction)
    //   multiplier   = 1 + (15 / 100) * 3 = 1.45
    //   estimated    = round(2,000,000 × 1.45)    = 2,900,000
    const result = computeEstimatedValue(
      2_000_000n,
      new Decimal("15"),
      acquisitionDate,
      NOW,
    );

    expect(result).toBe(2_900_000n);
  });
});

// EPIC-024 D2/US-ASSET-6: fixed-Rp/year depreciation mode. Golden values are
// hand-computed independently of computeEstimatedValue below, per the same
// discipline as the percent-mode golden test above — a test written after a
// wrong formula can otherwise assert an identity that "passes" by
// construction (see the epic's own retro on this class of mistake).
describe("computeEstimatedValue — fixed mode golden values (EPIC-024 D2)", () => {
  const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
  const NOW = new Date("2026-01-01T00:00:00.000Z");

  it("Rp 50,000,000 depreciating Rp 5,000,000/yr (fixed) over exactly 3 years → Rp 35,000,000", () => {
    // `since` is constructed to be exactly 3 × MS_PER_YEAR before `now`, so
    // yearsElapsed inside the function is exactly 3 — no calendar slack.
    const acquisitionDate = new Date(NOW.getTime() - 3 * MS_PER_YEAR);

    // Hand computation (independent of the function under test):
    //   yearsElapsed = 3                                   (exact, by construction)
    //   delta        = -5,000,000 × 3        = -15,000,000
    //   estimated    = round(50,000,000 + -15,000,000) = 35,000,000
    const result = computeEstimatedValue(
      50_000_000n,
      null, // valueChangeRatePct is unused in fixed mode
      acquisitionDate,
      NOW,
      "fixed",
      -5_000_000n,
    );

    expect(result).toBe(35_000_000n);
  });

  it("Rp 50,000,000 depreciating Rp 5,000,000/yr (fixed) over exactly 11 years floors at Rp 0, never negative", () => {
    const acquisitionDate = new Date(NOW.getTime() - 11 * MS_PER_YEAR);

    // Hand computation:
    //   yearsElapsed = 11
    //   delta        = -5,000,000 × 11 = -55,000,000
    //   raw          = 50,000,000 + -55,000,000 = -5,000,000  (negative!)
    //   estimated    = max(-5,000,000, 0) = 0                 (floored)
    const result = computeEstimatedValue(
      50_000_000n,
      null,
      acquisitionDate,
      NOW,
      "fixed",
      -5_000_000n,
    );

    expect(result).toBe(0n);
    expect(result >= 0n).toBe(true);
  });

  it("appreciates linearly for a positive fixed amount", () => {
    const acquisitionDate = new Date(NOW.getTime() - 2 * MS_PER_YEAR);

    // Hand computation:
    //   yearsElapsed = 2
    //   delta        = 1,000,000 × 2 = 2,000,000
    //   estimated    = 10,000,000 + 2,000,000 = 12,000,000
    const result = computeEstimatedValue(
      10_000_000n,
      null,
      acquisitionDate,
      NOW,
      "fixed",
      1_000_000n,
    );

    expect(result).toBe(12_000_000n);
  });

  it("returns currentValue unchanged when fixed amount is null", () => {
    const result = computeEstimatedValue(
      1_000_000n,
      null,
      new Date(NOW.getTime() - MS_PER_YEAR),
      NOW,
      "fixed",
      null,
    );
    expect(result).toBe(1_000_000n);
  });

  it("returns currentValue unchanged when fixed amount is zero", () => {
    const result = computeEstimatedValue(
      1_000_000n,
      null,
      new Date(NOW.getTime() - MS_PER_YEAR),
      NOW,
      "fixed",
      0n,
    );
    expect(result).toBe(1_000_000n);
  });

  it("ignores valueChangeRatePct entirely when mode is fixed", () => {
    // A percent rate that would otherwise appreciate the asset must have no
    // effect once mode is "fixed" — only valueChangeAmount is read.
    const acquisitionDate = new Date(NOW.getTime() - 1 * MS_PER_YEAR);
    const result = computeEstimatedValue(
      1_000_000n,
      new Decimal("50"), // would be +500,000 in percent mode
      acquisitionDate,
      NOW,
      "fixed",
      -100_000n,
    );
    expect(result).toBe(900_000n);
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

  describe("update — valueChangeRatePct bounds", () => {
    const existingAsset = {
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
    };

    it("accepts a rate within -100..100", async () => {
      prisma.asset.findUnique.mockResolvedValue(existingAsset);
      prisma.asset.update.mockResolvedValue({
        ...existingAsset,
        valueChangeRatePct: new Decimal("7.5"),
      });

      await expect(
        service.update(FAMILY_GROUP_ID, ASSET_ID, {
          valueChangeRatePct: "7.5",
        }),
      ).resolves.toBeDefined();
      expect(prisma.asset.update).toHaveBeenCalled();
    });

    it("rejects a rate above 100 on update", async () => {
      prisma.asset.findUnique.mockResolvedValue(existingAsset);

      await expect(
        service.update(FAMILY_GROUP_ID, ASSET_ID, {
          valueChangeRatePct: "101",
        }),
      ).rejects.toThrow();
      expect(prisma.asset.update).not.toHaveBeenCalled();
    });

    it("rejects a rate below -100 on update", async () => {
      prisma.asset.findUnique.mockResolvedValue(existingAsset);

      await expect(
        service.update(FAMILY_GROUP_ID, ASSET_ID, {
          valueChangeRatePct: "-101",
        }),
      ).rejects.toThrow();
      expect(prisma.asset.update).not.toHaveBeenCalled();
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
          acquisitionDate: null,
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

  // EPIC-023 D19/US-ASSET-4: computeEstimatedValue's `since` argument must
  // come from acquisitionDate when present, and fall back to createdAt only
  // when acquisitionDate is null (legacy assets that predate the field).
  // Real elapsed-time-since-now is used inside toAssetDto (no injectable
  // clock), so these assert on the DIRECTION of the drift rather than an
  // exact figure: a large rate over a decade-old date measurably moves the
  // estimate away from currentValue; a millisecond-old date does not.
  describe("toAssetDto — acquisitionDate anchors the projection, createdAt is the legacy fallback", () => {
    const TEN_YEARS_AGO = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 10);

    it("uses acquisitionDate as the elapsed-time anchor when set, ignoring a recent createdAt", async () => {
      prisma.asset.findMany.mockResolvedValue([
        {
          id: ASSET_ID,
          familyGroupId: FAMILY_GROUP_ID,
          name: "Rumah",
          type: "properti",
          currentValue: 1_000_000_000n,
          currency: "IDR",
          notes: null,
          valueChangeRatePct: new Decimal("50"),
          categoryId: null,
          acquisitionDate: TEN_YEARS_AGO,
          createdAt: new Date(), // recent — must NOT be what drives the estimate
          updatedAt: new Date(),
        },
      ]);

      const [result] = await service.findAll(FAMILY_GROUP_ID);

      expect(Number(result?.currentEstimatedValue)).toBeGreaterThan(
        1_000_000_000,
      );
    });

    it("falls back to createdAt when acquisitionDate is null (legacy assets keep working)", async () => {
      prisma.asset.findMany.mockResolvedValue([
        {
          id: ASSET_ID,
          familyGroupId: FAMILY_GROUP_ID,
          name: "Rumah Lama",
          type: "properti",
          currentValue: 1_000_000_000n,
          currency: "IDR",
          notes: null,
          valueChangeRatePct: new Decimal("50"),
          categoryId: null,
          acquisitionDate: null,
          createdAt: TEN_YEARS_AGO,
          updatedAt: new Date(),
        },
      ]);

      const [result] = await service.findAll(FAMILY_GROUP_ID);

      expect(Number(result?.currentEstimatedValue)).toBeGreaterThan(
        1_000_000_000,
      );
    });

    it("stays at currentValue when acquisitionDate is set to right now, regardless of an old createdAt", async () => {
      prisma.asset.findMany.mockResolvedValue([
        {
          id: ASSET_ID,
          familyGroupId: FAMILY_GROUP_ID,
          name: "Rumah Baru Dibeli",
          type: "properti",
          currentValue: 1_000_000_000n,
          currency: "IDR",
          notes: null,
          valueChangeRatePct: new Decimal("50"),
          categoryId: null,
          acquisitionDate: new Date(),
          createdAt: TEN_YEARS_AGO,
          updatedAt: new Date(),
        },
      ]);

      const [result] = await service.findAll(FAMILY_GROUP_ID);

      expect(result?.currentEstimatedValue).toBe("1000000000");
    });
  });

  describe("create/update — acquisitionDate", () => {
    it("create persists and returns the acquisitionDate", async () => {
      const acquisitionDate = "2020-06-15";
      prisma.asset.create.mockResolvedValue({
        id: ASSET_ID,
        familyGroupId: FAMILY_GROUP_ID,
        name: "Rumah",
        type: "properti",
        currentValue: 1_000_000_000n,
        currency: "IDR",
        notes: null,
        valueChangeRatePct: null,
        categoryId: null,
        acquisitionDate: new Date(acquisitionDate),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(FAMILY_GROUP_ID, {
        name: "Rumah",
        type: "properti",
        currentValue: "1000000000",
        acquisitionDate,
      });

      expect(prisma.asset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            acquisitionDate: new Date(acquisitionDate),
          }),
        }),
      );
      expect(result.acquisitionDate).toBe(
        new Date(acquisitionDate).toISOString(),
      );
    });

    it("create omits acquisitionDate → persisted as null", async () => {
      prisma.asset.create.mockResolvedValue({
        id: ASSET_ID,
        familyGroupId: FAMILY_GROUP_ID,
        name: "Rumah",
        type: "properti",
        currentValue: 1_000_000_000n,
        currency: "IDR",
        notes: null,
        valueChangeRatePct: null,
        categoryId: null,
        acquisitionDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(FAMILY_GROUP_ID, {
        name: "Rumah",
        type: "properti",
        currentValue: "1000000000",
      });

      expect(prisma.asset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ acquisitionDate: null }),
        }),
      );
      expect(result.acquisitionDate).toBeNull();
    });

    it("update persists and returns a new acquisitionDate", async () => {
      const existingAsset = {
        id: ASSET_ID,
        familyGroupId: FAMILY_GROUP_ID,
        name: "Rumah",
        type: "properti",
        currentValue: 1_000_000_000n,
        currency: "IDR",
        notes: null,
        valueChangeRatePct: null,
        categoryId: null,
        acquisitionDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.asset.findUnique.mockResolvedValue(existingAsset);
      const newDate = "2019-03-01";
      prisma.asset.update.mockResolvedValue({
        ...existingAsset,
        acquisitionDate: new Date(newDate),
      });

      const result = await service.update(FAMILY_GROUP_ID, ASSET_ID, {
        acquisitionDate: newDate,
      });

      expect(prisma.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            acquisitionDate: new Date(newDate),
          }),
        }),
      );
      expect(result.acquisitionDate).toBe(new Date(newDate).toISOString());
    });

    it("rejects an invalid acquisitionDate string on create", async () => {
      await expect(
        service.create(FAMILY_GROUP_ID, {
          name: "Rumah",
          type: "properti",
          currentValue: "1000000000",
          acquisitionDate: "not-a-date",
        }),
      ).rejects.toThrow();
      expect(prisma.asset.create).not.toHaveBeenCalled();
    });

    it("rejects a future acquisitionDate on create", async () => {
      const fiveYearsFromNow = new Date(
        Date.now() + 1000 * 60 * 60 * 24 * 365 * 5,
      )
        .toISOString()
        .slice(0, 10);

      await expect(
        service.create(FAMILY_GROUP_ID, {
          name: "Rumah",
          type: "properti",
          currentValue: "1000000000",
          acquisitionDate: fiveYearsFromNow,
        }),
      ).rejects.toThrow();
      expect(prisma.asset.create).not.toHaveBeenCalled();
    });

    // EPIC-023 Task H1 review (HIGH fix 1): reproduces the WIB off-by-one
    // this fix closes. Fake "now" = 2026-08-04T18:00:00.000Z, which is WIB
    // (UTC+7) 2026-08-05T01:00:00 — 01:00 local time in Jakarta. The OLD
    // code compared `new Date("2026-08-05").getTime() > Date.now()`: the
    // UTC-midnight parse of "2026-08-05" (2026-08-05T00:00:00.000Z) is
    // LATER than this fake "now", so it wrongly rejected WIB "today" as
    // being in the future. Follows billing-cycle.processor.spec.ts's
    // jest.useFakeTimers()/setSystemTime pattern for faking Date.now(),
    // since this service has no injectable clock.
    describe("create — acquisitionDate WIB 'today' boundary", () => {
      afterEach(() => {
        jest.useRealTimers();
      });

      it("accepts WIB 'today' during the early-morning window where it is still UTC 'yesterday evening'", async () => {
        jest
          .useFakeTimers()
          .setSystemTime(new Date("2026-08-04T18:00:00.000Z"));

        prisma.asset.create.mockResolvedValue({
          id: ASSET_ID,
          familyGroupId: FAMILY_GROUP_ID,
          name: "Rumah",
          type: "properti",
          currentValue: 1_000_000_000n,
          currency: "IDR",
          notes: null,
          valueChangeRatePct: null,
          categoryId: null,
          acquisitionDate: new Date("2026-08-05"),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await expect(
          service.create(FAMILY_GROUP_ID, {
            name: "Rumah",
            type: "properti",
            currentValue: "1000000000",
            acquisitionDate: "2026-08-05",
          }),
        ).resolves.toBeDefined();
        expect(prisma.asset.create).toHaveBeenCalled();
      });
    });

    it("rejects an invalid acquisitionDate string on update", async () => {
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
        acquisitionDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.update(FAMILY_GROUP_ID, ASSET_ID, {
          acquisitionDate: "not-a-date",
        }),
      ).rejects.toThrow();
      expect(prisma.asset.update).not.toHaveBeenCalled();
    });
  });

  // EPIC-024 D2/US-ASSET-6
  describe("create/update — valueChangeMode / valueChangeAmount", () => {
    it("create persists fixed mode and a signed valueChangeAmount", async () => {
      prisma.asset.create.mockResolvedValue({
        id: ASSET_ID,
        familyGroupId: FAMILY_GROUP_ID,
        name: "Mobil",
        type: "kendaraan",
        currentValue: 200_000_000n,
        currency: "IDR",
        notes: null,
        valueChangeRatePct: null,
        valueChangeMode: "fixed",
        valueChangeAmount: -20_000_000n,
        categoryId: null,
        acquisitionDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(FAMILY_GROUP_ID, {
        name: "Mobil",
        type: "kendaraan",
        currentValue: "200000000",
        valueChangeMode: "fixed",
        valueChangeAmount: "-20000000",
      });

      expect(prisma.asset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            valueChangeMode: "fixed",
            valueChangeAmount: -20_000_000n,
          }),
        }),
      );
      expect(result.valueChangeMode).toBe("fixed");
      expect(result.valueChangeAmount).toBe("-20000000");
    });

    it("create defaults to percent mode with a null amount when omitted", async () => {
      prisma.asset.create.mockResolvedValue({
        id: ASSET_ID,
        familyGroupId: FAMILY_GROUP_ID,
        name: "Rumah",
        type: "properti",
        currentValue: 1_000_000_000n,
        currency: "IDR",
        notes: null,
        valueChangeRatePct: null,
        valueChangeMode: "percent",
        valueChangeAmount: null,
        categoryId: null,
        acquisitionDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(FAMILY_GROUP_ID, {
        name: "Rumah",
        type: "properti",
        currentValue: "1000000000",
      });

      expect(prisma.asset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            valueChangeMode: "percent",
            valueChangeAmount: null,
          }),
        }),
      );
      expect(result.valueChangeMode).toBe("percent");
      expect(result.valueChangeAmount).toBeNull();
    });

    it("update switches an existing asset from percent to fixed mode", async () => {
      const existingAsset = {
        id: ASSET_ID,
        familyGroupId: FAMILY_GROUP_ID,
        name: "Mobil",
        type: "kendaraan",
        currentValue: 200_000_000n,
        currency: "IDR",
        notes: null,
        valueChangeRatePct: new Decimal("-12"),
        valueChangeMode: "percent" as const,
        valueChangeAmount: null,
        categoryId: null,
        acquisitionDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.asset.findUnique.mockResolvedValue(existingAsset);
      prisma.asset.update.mockResolvedValue({
        ...existingAsset,
        valueChangeMode: "fixed",
        valueChangeAmount: -20_000_000n,
      });

      const result = await service.update(FAMILY_GROUP_ID, ASSET_ID, {
        valueChangeMode: "fixed",
        valueChangeAmount: "-20000000",
      });

      expect(prisma.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            valueChangeMode: "fixed",
            valueChangeAmount: -20_000_000n,
          }),
        }),
      );
      expect(result.valueChangeMode).toBe("fixed");
      expect(result.valueChangeAmount).toBe("-20000000");
    });

    it("rejects a non-integer valueChangeAmount string", async () => {
      await expect(
        service.create(FAMILY_GROUP_ID, {
          name: "Mobil",
          type: "kendaraan",
          currentValue: "200000000",
          valueChangeAmount: "not-a-number",
        }),
      ).rejects.toThrow();
      expect(prisma.asset.create).not.toHaveBeenCalled();
    });
  });
  describe("shared-with-others toggle and gold quantity", () => {
    it("findAll hides private assets from viewers who cannot see them", async () => {
      prisma.asset.findMany.mockResolvedValue([]);

      await service.findAll(FAMILY_GROUP_ID, false);

      expect(prisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { familyGroupId: FAMILY_GROUP_ID, isPrivate: false },
        }),
      );
    });

    it("findAll does not filter for Master / Co-Master viewers", async () => {
      prisma.asset.findMany.mockResolvedValue([]);

      await service.findAll(FAMILY_GROUP_ID, true);

      expect(prisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { familyGroupId: FAMILY_GROUP_ID } }),
      );
    });

    it("create stores gold quantity with its unit and isPrivate", async () => {
      prisma.asset.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: ASSET_ID,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
          quantity: data.quantity === null ? null : new Decimal(data.quantity),
        }),
      );
      prisma.assetHistory.create.mockResolvedValue({});

      const result = await service.create(FAMILY_GROUP_ID, {
        name: "Emas",
        type: "emas",
        currentValue: "1100000000",
        quantity: "500",
        quantityUnit: "gram",
        isPrivate: true,
      });

      expect(result.quantity).toBe("500");
      expect(result.quantityUnit).toBe("gram");
      expect(result.isPrivate).toBe(true);
    });

    it("create drops the unit when no quantity is given", async () => {
      prisma.asset.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: ASSET_ID,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        }),
      );
      prisma.assetHistory.create.mockResolvedValue({});

      const result = await service.create(FAMILY_GROUP_ID, {
        name: "Rumah",
        type: "properti",
        currentValue: "1",
        quantityUnit: "kg",
      });

      expect(result.quantity).toBeNull();
      expect(result.quantityUnit).toBeNull();
      expect(result.isPrivate).toBe(false);
    });
  });
});
