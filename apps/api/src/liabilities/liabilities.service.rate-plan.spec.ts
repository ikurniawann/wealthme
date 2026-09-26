import { Test } from "@nestjs/testing";

import { NOTIFICATION_SENDER_PORT } from "../notifications/notification-sender.port";
import { PrismaService } from "../prisma/prisma.service";

import { LiabilitiesService } from "./liabilities.service";

jest.mock("../transactions/transaction-alerts.util", () => ({
  checkBudgetAlert: jest.fn(),
  checkCashFlowAlert: jest.fn(),
  notifyTransaction: jest.fn(),
}));

function makePrisma() {
  const prisma = {
    liability: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    liabilityRatePeriod: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    liabilityFloatingRate: { findMany: jest.fn().mockResolvedValue([]) },
    account: { findUnique: jest.fn(), update: jest.fn() },
    member: { findUnique: jest.fn() },
    category: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ coaAccountId: "coa-5" }),
      create: jest.fn(),
    },
    coaAccount: { findFirst: jest.fn(), update: jest.fn() },
    budget: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      deleteMany: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    notification: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma),
  );
  return prisma;
}

// Berjenjang 500 jt / 240 bln, akad 2026-01-15: 3.50% x24, 5.50% x12, floating 11.00%.
const KPR = {
  id: "lid-1",
  familyGroupId: "fg-1",
  name: "KPR BTN",
  institution: "BTN",
  type: "kpr",
  totalDebt: 500_000_000n,
  remainingBalance: 500_000_000n,
  minimumPayment: 2_899_799n,
  interestRate: { toString: () => "3.50" },
  dueDate: null,
  autoAdvanceDueDate: false,
  notes: null,
  currency: "IDR",
  interestMethod: "anuitas",
  tenorMonths: 240,
  startDate: new Date("2026-01-15T00:00:00.000Z"),
  installmentAmount: 2_899_799n,
  fixedRateMonths: null,
  floatingRate: null,
  kprScheme: "berjenjang",
  principalCategoryId: "cat-principal",
  createdAt: new Date("2026-01-15T00:00:00.000Z"),
  updatedAt: new Date("2026-01-15T00:00:00.000Z"),
};
// G-era row: 8% fixed 36 bln then 11% floating, no K rows.
const LEGACY_KPR = {
  ...KPR,
  interestRate: { toString: () => "8.00" },
  installmentAmount: 4_182_200n,
  minimumPayment: 4_182_200n,
  fixedRateMonths: 36,
  floatingRate: { toString: () => "11.00" },
  kprScheme: null,
};

const PERIOD_ROWS = [
  {
    liabilityId: "lid-1",
    sequence: 0,
    kind: "fixed",
    months: 24,
    ratePercent: { toString: () => "3.50" },
  },
  {
    liabilityId: "lid-1",
    sequence: 1,
    kind: "fixed",
    months: 12,
    ratePercent: { toString: () => "5.50" },
  },
  {
    liabilityId: "lid-1",
    sequence: 2,
    kind: "floating",
    months: null,
    ratePercent: { toString: () => "11.00" },
  },
];

describe("LiabilitiesService — revisi K", () => {
  let service: LiabilitiesService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = makePrisma();
    const moduleRef = await Test.createTestingModule({
      providers: [
        LiabilitiesService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NOTIFICATION_SENDER_PORT,
          useValue: { send: jest.fn(), sendEmail: jest.fn() },
        },
      ],
    }).compile();
    service = moduleRef.get(LiabilitiesService);
  });

  describe("response shape (legacy rows)", () => {
    it("findAll exposes currentRatePercent from the plan, no scheme, no stored periods", async () => {
      prisma.liability.findMany.mockResolvedValue([LEGACY_KPR]);

      const [dto] = await service.findAll(
        "fg-1",
        new Date("2029-02-20T00:00:00.000Z"),
      );

      expect(dto?.currentRatePercent).toBe("11.00");
      // #37 fell due 2029-02-15: 2029-02-20 is inside the 5-day grace window.
      expect(dto?.currentInstallmentLate).toBe(true);
      expect(dto?.kprScheme).toBeNull();
      expect(dto?.ratePeriods).toEqual([]);
    });

    it("getSchedule returns rate bands over the rows and flags the floating tail", async () => {
      prisma.liability.findUnique.mockResolvedValue(LEGACY_KPR);

      const schedule = await service.getSchedule(
        "fg-1",
        "lid-1",
        new Date("2026-01-20T00:00:00.000Z"),
      );

      expect(schedule.rows).toHaveLength(240);
      expect(schedule.rateBands).toEqual([
        { fromPeriod: 1, toPeriod: 36, ratePercent: "8.00", kind: "fixed" },
        {
          fromPeriod: 37,
          toPeriod: 240,
          ratePercent: "11.00",
          kind: "floating",
        },
      ]);
      expect(schedule.hasFloatingPeriod).toBe(true);
    });
  });

  describe("rate plan readers", () => {
    function withPeriods() {
      prisma.liabilityRatePeriod.findMany.mockResolvedValue(PERIOD_ROWS);
    }

    it("schedule at 2028-02-21 (six days after #25 fell due): next installment #26 re-annuitised in tier 2, floating from #37", async () => {
      withPeriods();
      prisma.liability.findUnique.mockResolvedValue({
        ...KPR,
        remainingBalance: 462_956_643n,
      });

      const schedule = await service.getSchedule(
        "fg-1",
        "lid-1",
        new Date("2028-02-21T00:00:00.000Z"),
      );

      expect(schedule.rows[0]).toEqual({
        period: 26,
        installment: "3390269",
        interest: "2121885",
        principal: "1268384",
        remaining: "461688259",
      });
      expect(schedule.rows).toHaveLength(215);
      expect(schedule.rateBands).toEqual([
        { fromPeriod: 26, toPeriod: 36, ratePercent: "5.50", kind: "fixed" },
        {
          fromPeriod: 37,
          toPeriod: 240,
          ratePercent: "11.00",
          kind: "floating",
        },
      ]);
      expect(prisma.liabilityRatePeriod.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { familyGroupId: "fg-1", liabilityId: { in: ["lid-1"] } },
        }),
      );
    });

    it.each([
      ["2028-01-14T08:00:00.000Z", "1353973", "2036296"],
      ["2028-01-15T08:00:00.000Z", "1353973", "2036296"],
      ["2028-01-20T08:00:00.000Z", "1353973", "2036296"],
      ["2028-01-21T08:00:00.000Z", "2127672", "1262597"],
      ["2028-02-15T08:00:00.000Z", "2127672", "1262597"],
    ])(
      "boundary: a payment on %s books interest %s (#24 from the day before through 5 days late in tier 1, #25 from day +6 in tier 2)",
      async (now, interest, principal) => {
        withPeriods();
        prisma.liability.findUnique.mockResolvedValue({
          ...KPR,
          remainingBalance: 464_219_240n,
        });

        const preview = await service.previewPayment(
          "fg-1",
          "lid-1",
          "3390269",
          new Date(now),
        );

        expect(preview.interest).toBe(interest);
        expect(preview.principal).toBe(principal);
      },
    );

    it.each([
      ["2028-01-15T08:00:00.000Z", 465_760_571n, "2899799", "3.50", false],
      ["2028-01-20T08:00:00.000Z", 465_760_571n, "2899799", "3.50", true],
      ["2028-01-21T08:00:00.000Z", 464_219_240n, "3390269", "5.50", false],
    ])(
      "Pay preset on %s is the installment pay() books (5-day grace at the tier boundary)",
      async (now, balance, preset, rate, late) => {
        withPeriods();
        prisma.liability.findMany.mockResolvedValue([
          { ...KPR, remainingBalance: balance },
        ]);

        const [dto] = await service.findAll("fg-1", new Date(now));

        expect(dto?.currentInstallmentAmount).toBe(preset);
        expect(dto?.currentRatePercent).toBe(rate);
        expect(dto?.currentInstallmentLate).toBe(late);
      },
    );

    it("floating history: a change effective 2031-01-15 bites at installment 61, not 60", async () => {
      withPeriods();
      prisma.liabilityFloatingRate.findMany.mockResolvedValue([
        {
          id: "fr-1",
          liabilityId: "lid-1",
          effectiveDate: new Date("2031-01-15T00:00:00.000Z"),
          ratePercent: { toString: () => "9.75" },
          note: null,
          createdAt: new Date("2031-01-10T00:00:00.000Z"),
        },
      ]);
      prisma.liability.findUnique.mockResolvedValue({
        ...KPR,
        remainingBalance: 428_462_235n,
      });

      const on60 = await service.previewPayment(
        "fg-1",
        "lid-1",
        "4869888",
        new Date("2031-01-15T08:00:00.000Z"),
      );
      const on61 = await service.previewPayment(
        "fg-1",
        "lid-1",
        "4869888",
        new Date("2031-02-15T08:00:00.000Z"),
      );

      expect(on60.interest).toBe("3927570");
      expect(on61.interest).toBe("3481256");
    });

    it("pay books the tier-2 interest the preview showed and syncs the budget line to the plan", async () => {
      withPeriods();
      const row = { ...KPR, remainingBalance: 464_219_240n };
      prisma.liability.findUnique.mockResolvedValue(row);
      prisma.account.findUnique.mockResolvedValue({
        id: "acc-1",
        familyGroupId: "fg-1",
        type: "bank",
        balance: 50_000_000n,
        name: "BCA",
      });
      prisma.category.findFirst.mockResolvedValueOnce({ id: "cat-interest" });
      prisma.liability.update.mockResolvedValue({
        ...row,
        remainingBalance: 462_956_643n,
      });

      const dto = await service.pay(
        "fg-1",
        "lid-1",
        { sourceAccountId: "acc-1", amount: "3390269" },
        new Date("2028-02-15T08:00:00.000Z"),
      );

      expect(prisma.liability.update).toHaveBeenCalledWith({
        where: { id: "lid-1", familyGroupId: "fg-1" },
        data: { remainingBalance: { decrement: 1_262_597n } },
      });
      expect(prisma.budget.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ limitAmount: 3_390_269n }),
        }),
      );
      expect(dto.currentRatePercent).toBe("5.50");
      expect(dto.ratePeriods).toHaveLength(3);
    });

    it("findAll loads every liability's rows in one tenant-scoped query per table", async () => {
      prisma.liability.findMany.mockResolvedValue([
        KPR,
        { ...LEGACY_KPR, id: "lid-2" },
      ]);
      withPeriods();

      const dtos = await service.findAll(
        "fg-1",
        new Date("2028-02-21T00:00:00.000Z"),
      );

      expect(prisma.liabilityRatePeriod.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.liabilityRatePeriod.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            familyGroupId: "fg-1",
            liabilityId: { in: ["lid-1", "lid-2"] },
          },
        }),
      );
      expect(dtos[0]?.ratePeriods).toEqual([
        { kind: "fixed", months: 24, ratePercent: "3.50" },
        { kind: "fixed", months: 12, ratePercent: "5.50" },
        { kind: "floating", months: null, ratePercent: "11.00" },
      ]);
      expect(dtos[0]?.currentRatePercent).toBe("5.50");
      expect(dtos[1]?.ratePeriods).toEqual([]);
      expect(dtos[1]?.currentRatePercent).toBe("8.00");
    });
  });
});
