import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { LiabilityFloatingRatesService } from "./liability-floating-rates.service";

const NOW = new Date("2031-02-20T00:00:00.000Z");
const KPR = {
  id: "lid-1",
  familyGroupId: "fg-1",
  name: "KPR BTN",
  type: "kpr",
  interestMethod: "anuitas",
  interestRate: { toString: () => "8.00" },
  tenorMonths: 240,
  startDate: new Date("2026-01-15T00:00:00.000Z"),
  fixedRateMonths: 36,
  floatingRate: { toString: () => "11.00" },
  minimumPayment: 4_182_200n,
  remainingBalance: 427_404_522n,
};
const EXISTING = {
  id: "fr-0",
  liabilityId: "lid-1",
  effectiveDate: new Date("2030-01-15T00:00:00.000Z"),
  ratePercent: { toString: () => "10.50" },
  note: null,
  createdAt: new Date("2030-01-10T00:00:00.000Z"),
};

function makePrisma() {
  const prisma = {
    liability: { findUnique: jest.fn().mockResolvedValue(KPR) },
    liabilityRatePeriod: { findMany: jest.fn().mockResolvedValue([]) },
    liabilityFloatingRate: {
      findMany: jest.fn().mockResolvedValue([EXISTING]),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma),
  );
  return prisma;
}

describe("LiabilityFloatingRatesService — revisi K", () => {
  let prisma: ReturnType<typeof makePrisma>;
  let liabilities: { resyncBudgetLine: jest.Mock };
  let service: LiabilityFloatingRatesService;

  beforeEach(() => {
    prisma = makePrisma();
    liabilities = { resyncBudgetLine: jest.fn() };
    service = new LiabilityFloatingRatesService(
      prisma as never,
      liabilities as never,
    );
  });

  it("add: stores the change tenant-scoped, returns its first installment, re-syncs the budget line in the same transaction", async () => {
    const created = {
      id: "fr-1",
      liabilityId: "lid-1",
      effectiveDate: new Date("2031-01-15T00:00:00.000Z"),
      ratePercent: { toString: () => "9.75" },
      note: null,
      createdAt: NOW,
    };
    prisma.liabilityFloatingRate.create.mockResolvedValue(created);

    const dto = await service.add(
      "fg-1",
      "lid-1",
      { effectiveDate: "2031-01-15", ratePercent: "9.75" },
      "user-1",
      NOW,
    );

    expect(prisma.liability.findUnique).toHaveBeenCalledWith({
      where: { id: "lid-1", familyGroupId: "fg-1" },
    });
    expect(prisma.liabilityFloatingRate.create).toHaveBeenCalledWith({
      data: {
        familyGroupId: "fg-1",
        liabilityId: "lid-1",
        effectiveDate: new Date("2031-01-15T00:00:00.000Z"),
        ratePercent: "9.75",
        note: null,
        createdByUserId: "user-1",
      },
    });
    expect(dto).toEqual({
      id: "fr-1",
      effectiveDate: "2031-01-15",
      ratePercent: "9.75",
      effectivePeriod: 61,
      note: null,
      createdAt: NOW.toISOString(),
    });
    expect(liabilities.resyncBudgetLine).toHaveBeenCalledWith(
      prisma,
      "fg-1",
      expect.objectContaining({
        id: "lid-1",
        ratePlanRows: { ratePeriods: [], floatingRates: [EXISTING, created] },
      }),
      NOW,
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("add: a liability of another family is a 404 and nothing is written", async () => {
    prisma.liability.findUnique.mockResolvedValue(null);

    await expect(
      service.add(
        "fg-2",
        "lid-1",
        { effectiveDate: "2031-01-15", ratePercent: "9.75" },
        null,
        NOW,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.liabilityFloatingRate.create).not.toHaveBeenCalled();
  });

  it.each([
    [
      "before the akad",
      { effectiveDate: "2026-01-14", ratePercent: "9.75" },
      {},
    ],
    ["past maturity", { effectiveDate: "2046-01-15", ratePercent: "9.75" }, {}],
    ["above 30%", { effectiveDate: "2031-01-15", ratePercent: "30.01" }, {}],
    [
      "without a Tanggal Akad",
      { effectiveDate: "2031-01-15", ratePercent: "9.75" },
      { startDate: null },
    ],
    [
      "on a loan with no floating period",
      { effectiveDate: "2031-01-15", ratePercent: "9.75" },
      { fixedRateMonths: null, floatingRate: null },
    ],
    [
      "on a flat loan",
      { effectiveDate: "2031-01-15", ratePercent: "9.75" },
      { interestMethod: "flat" },
    ],
  ])("add: 400 %s", async (_label, dto, patch) => {
    prisma.liability.findUnique.mockResolvedValue({ ...KPR, ...patch });

    await expect(service.add("fg-1", "lid-1", dto, null, NOW)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.liabilityFloatingRate.create).not.toHaveBeenCalled();
  });

  it("add: a second change on the same date is a 409", async () => {
    await expect(
      service.add(
        "fg-1",
        "lid-1",
        { effectiveDate: "2030-01-15", ratePercent: "9.75" },
        null,
        NOW,
      ),
    ).rejects.toThrow(ConflictException);
    expect(prisma.liabilityFloatingRate.create).not.toHaveBeenCalled();
  });

  it("add: a concurrent duplicate (P2002 after retries) is a 409, not a 500", async () => {
    prisma.liabilityFloatingRate.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    await expect(
      service.add(
        "fg-1",
        "lid-1",
        { effectiveDate: "2031-01-15", ratePercent: "9.75" },
        null,
        NOW,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it("remove: deletes by id AND liability AND family, then re-syncs without it", async () => {
    await service.remove("fg-1", "lid-1", "fr-0", NOW);

    expect(prisma.liabilityFloatingRate.deleteMany).toHaveBeenCalledWith({
      where: { id: "fr-0", liabilityId: "lid-1", familyGroupId: "fg-1" },
    });
    expect(liabilities.resyncBudgetLine).toHaveBeenCalledWith(
      prisma,
      "fg-1",
      expect.objectContaining({
        ratePlanRows: { ratePeriods: [], floatingRates: [] },
      }),
      NOW,
    );
  });

  it("remove: an id that is not this liability's is a 404", async () => {
    await expect(
      service.remove("fg-1", "lid-1", "fr-other", NOW),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.liabilityFloatingRate.deleteMany).not.toHaveBeenCalled();
  });

  it("list: tenant-scoped, with each change's first installment", async () => {
    expect(await service.list("fg-1", "lid-1")).toEqual([
      {
        id: "fr-0",
        effectiveDate: "2030-01-15",
        ratePercent: "10.50",
        effectivePeriod: 49,
        note: null,
        createdAt: "2030-01-10T00:00:00.000Z",
      },
    ]);
    expect(prisma.liabilityFloatingRate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { familyGroupId: "fg-1", liabilityId: { in: ["lid-1"] } },
      }),
    );
  });
});
