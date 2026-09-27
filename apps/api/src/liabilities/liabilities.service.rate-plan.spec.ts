import { BadRequestException, ConflictException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Prisma } from "@prisma/client";

import { NOTIFICATION_SENDER_PORT } from "../notifications/notification-sender.port";
import { PrismaService } from "../prisma/prisma.service";

import { computeInstallment } from "./amortisation.util";
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
    liabilityPrepayment: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
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

const BERJENJANG_BODY = [
  { kind: "fixed", months: 24, ratePercent: "3.50" },
  { kind: "fixed", months: 12, ratePercent: "5.50" },
  { kind: "floating", months: null, ratePercent: "11.00" },
] as never;

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

  describe("rate plan writers", () => {
    function withPeriods() {
      prisma.liabilityRatePeriod.findMany.mockResolvedValue(PERIOD_ROWS);
    }

    it("create: stores berjenjang periods, derives interestRate and the tier-1 installment, nulls the legacy pair", async () => {
      prisma.liability.create.mockResolvedValue({ ...KPR });

      await service.create("fg-1", {
        name: "KPR BTN",
        type: "kpr" as never,
        totalDebt: "500000000",
        remainingBalance: "500000000",
        interestRate: "9.99",
        tenorMonths: 240,
        kprScheme: "berjenjang" as never,
        ratePeriods: BERJENJANG_BODY,
      });

      expect(prisma.liability.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          interestMethod: "anuitas",
          interestRate: "3.50",
          installmentAmount: 2_899_799n,
          minimumPayment: 2_899_799n,
          fixedRateMonths: null,
          floatingRate: null,
          kprScheme: "berjenjang",
        }),
      });
      expect(prisma.liabilityRatePeriod.createMany).toHaveBeenCalledWith({
        data: [
          {
            liabilityId: "lid-1",
            familyGroupId: "fg-1",
            sequence: 0,
            kind: "fixed",
            months: 24,
            ratePercent: "3.50",
          },
          {
            liabilityId: "lid-1",
            familyGroupId: "fg-1",
            sequence: 1,
            kind: "fixed",
            months: 12,
            ratePercent: "5.50",
          },
          {
            liabilityId: "lid-1",
            familyGroupId: "fg-1",
            sequence: 2,
            kind: "floating",
            months: null,
            ratePercent: "11.00",
          },
        ],
      });
      expect(prisma.budget.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ limitAmount: 2_899_799n }),
        }),
      );
    });

    it.each([
      ["with fixedRateMonths", { fixedRateMonths: 36 }],
      ["on a kendaraan", { type: "kendaraan" as never }],
    ])("create: ratePeriods %s is refused", async (_label, patch) => {
      await expect(
        service.create("fg-1", {
          name: "KPR",
          type: "kpr" as never,
          totalDebt: "500000000",
          remainingBalance: "500000000",
          tenorMonths: 240,
          ratePeriods: BERJENJANG_BODY,
          ...patch,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.liability.create).not.toHaveBeenCalled();
    });

    it("legacy upgrade: G's pair re-sent as equal periods writes rows, nulls the pair, keeps an overridden installment", async () => {
      const overridden = {
        ...LEGACY_KPR,
        installmentAmount: 4_200_000n,
        minimumPayment: 4_200_000n,
      };
      prisma.liability.findUnique.mockResolvedValue(overridden);
      prisma.liability.findUniqueOrThrow.mockResolvedValue(overridden);
      prisma.liability.update.mockResolvedValue(overridden);

      await service.update(
        "fg-1",
        "lid-1",
        {
          ratePeriods: [
            { kind: "fixed", months: 36, ratePercent: "8" },
            { kind: "floating", months: null, ratePercent: "11" },
          ] as never,
        },
        new Date("2026-03-01T00:00:00.000Z"),
      );

      expect(prisma.liability.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            installmentAmount: 4_200_000n,
            minimumPayment: 4_200_000n,
            fixedRateMonths: null,
            floatingRate: null,
          }),
        }),
      );
      expect(prisma.liabilityRatePeriod.createMany).toHaveBeenCalledWith({
        data: [
          {
            liabilityId: "lid-1",
            familyGroupId: "fg-1",
            sequence: 0,
            kind: "fixed",
            months: 36,
            ratePercent: "8",
          },
          {
            liabilityId: "lid-1",
            familyGroupId: "fg-1",
            sequence: 1,
            kind: "floating",
            months: null,
            ratePercent: "11",
          },
        ],
      });
    });

    it("a real tier change recomputes the installment from the new first-tier rate", async () => {
      withPeriods();
      prisma.liability.findUnique.mockResolvedValue(KPR);
      prisma.liability.findUniqueOrThrow.mockResolvedValue(KPR);
      prisma.liability.update.mockResolvedValue(KPR);

      await service.update(
        "fg-1",
        "lid-1",
        {
          ratePeriods: [
            { kind: "fixed", months: 24, ratePercent: "3.00" },
            { kind: "fixed", months: 12, ratePercent: "5.50" },
            { kind: "floating", months: null, ratePercent: "11.00" },
          ] as never,
        },
        new Date("2026-03-01T00:00:00.000Z"),
      );

      const expected = computeInstallment({
        method: "anuitas",
        principal: 500_000_000n,
        annualInterestRatePercent: "3.00",
        tenorMonths: 240,
      });
      expect(expected).toBe(2_772_988n);
      expect(prisma.liability.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            interestRate: "3.00",
            installmentAmount: expected,
          }),
        }),
      );
    });

    it.each([
      ["fixedRateMonths on a row that has periods", { fixedRateMonths: 36 }],
      [
        "a tenor no longer longer than the bounded periods",
        { tenorMonths: 36 },
      ],
    ])("update refuses %s", async (_label, dto) => {
      withPeriods();
      prisma.liability.findUnique.mockResolvedValue(KPR);
      prisma.liability.findUniqueOrThrow.mockResolvedValue(KPR);

      await expect(service.update("fg-1", "lid-1", dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.liability.update).not.toHaveBeenCalled();
    });

    // Review fix round 1 (CRITICAL) — switching interestMethod away from
    // anuitas used to always 400 for any KPR with stored periods (the
    // common case: the web form always writes ratePeriods for every
    // anuitas KPR) because the fallback re-validated the STALE anuitas
    // periods against the new method. A PATCH that (correctly) omits
    // ratePeriods when switching to flat must now succeed and retire the
    // stale stored plan instead.
    it("update: switching a planned KPR (stored periods, no floating history) to flat succeeds, computes the flat installment, and clears the stored plan", async () => {
      withPeriods();
      prisma.liability.findUnique.mockResolvedValue(KPR);
      prisma.liability.findUniqueOrThrow.mockResolvedValue(KPR);
      prisma.liability.update.mockImplementation(({ data }: { data: object }) =>
        Promise.resolve({ ...KPR, ...data }),
      );

      const dto = await service.update(
        "fg-1",
        "lid-1",
        { interestMethod: "flat" as never },
        new Date("2026-01-20T00:00:00.000Z"),
      );

      expect(dto.interestMethod).toBe("flat");
      expect(dto.ratePeriods).toEqual([]);
      // 3.50%/thn (KPR's first stored tier) over 240 bln flat.
      expect(dto.installmentAmount).not.toBeNull();
      expect(prisma.liabilityRatePeriod.deleteMany).toHaveBeenCalledWith({
        where: { familyGroupId: "fg-1", liabilityId: "lid-1" },
      });
      expect(prisma.liabilityRatePeriod.createMany).toHaveBeenCalledWith({
        data: [],
      });
      expect(prisma.liability.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            interestMethod: "flat",
            fixedRateMonths: null,
            floatingRate: null,
          }),
        }),
      );
    });

    it("update: switching a flat KPR back to anuitas with a sent rate plan succeeds", async () => {
      const flatKpr = {
        ...KPR,
        interestMethod: "flat",
        kprScheme: null,
      };
      prisma.liability.findUnique.mockResolvedValue(flatKpr);
      prisma.liability.findUniqueOrThrow.mockResolvedValue(flatKpr);
      prisma.liability.update.mockImplementation(({ data }: { data: object }) =>
        Promise.resolve({ ...flatKpr, ...data }),
      );

      const dto = await service.update(
        "fg-1",
        "lid-1",
        {
          interestMethod: "anuitas" as never,
          ratePeriods: [
            { kind: "fixed", months: null, ratePercent: "3.50" },
          ] as never,
        },
        new Date("2026-01-20T00:00:00.000Z"),
      );

      expect(dto.interestMethod).toBe("anuitas");
      expect(dto.ratePeriods).toEqual([
        { kind: "fixed", months: null, ratePercent: "3.50" },
      ]);
    });

    it("orphaned history: a legacy row with recorded floating changes refuses a PATCH that leaves them no floating period", async () => {
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
      prisma.liability.findUnique.mockResolvedValue(LEGACY_KPR);
      prisma.liability.findUniqueOrThrow.mockResolvedValue(LEGACY_KPR);

      await expect(
        service.update("fg-1", "lid-1", { interestMethod: "flat" as never }),
      ).rejects.toThrow(
        "Hapus riwayat bunga floating sebelum menghapus periode floating",
      );
      expect(prisma.liability.update).not.toHaveBeenCalled();
    });
  });

  describe("resyncBudgetLine", () => {
    it("re-derives the line from the plan including a recorded floating change (9.75% from #61)", async () => {
      await service.resyncBudgetLine(
        prisma as never,
        "fg-1",
        {
          ...KPR,
          remainingBalance: 427_404_522n,
          ratePlanRows: {
            ratePeriods: PERIOD_ROWS,
            floatingRates: [
              {
                id: "fr-1",
                liabilityId: "lid-1",
                effectiveDate: new Date("2031-01-15T00:00:00.000Z"),
                ratePercent: { toString: () => "9.75" },
                note: null,
                createdAt: new Date("2031-01-10T00:00:00.000Z"),
              },
            ],
          },
        } as never,
        new Date("2031-02-21T00:00:00.000Z"),
      );

      // Next is #62 with 179 left: 427,404,522 re-annuitised at 9.75%.
      expect(prisma.budget.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ limitAmount: 4_538_969n }),
        }),
      );
    });

    it("does nothing for a liability with no scheduled payment", async () => {
      await service.resyncBudgetLine(
        prisma as never,
        "fg-1",
        { ...KPR, minimumPayment: 0n } as never,
        new Date("2031-02-21T00:00:00.000Z"),
      );
      expect(prisma.budget.upsert).not.toHaveBeenCalled();
      expect(prisma.budget.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe("previewPrepayment", () => {
    // Single-rate 11% KPR, akad 2021-01-15: 2026-01-21 is six days after #60 fell due, so #61 (180 left) is being paid.
    const AT_61 = {
      ...KPR,
      interestRate: { toString: () => "11.00" },
      remainingBalance: 400_000_000n,
      installmentAmount: 4_546_388n,
      minimumPayment: 4_546_388n,
      startDate: new Date("2021-01-15T00:00:00.000Z"),
      kprScheme: null,
    };
    const NOW = new Date("2026-01-21T00:00:00.000Z");

    it("reduce installment: golden numbers as strings, read-only", async () => {
      prisma.liability.findUnique.mockResolvedValue(AT_61);

      expect(
        await service.previewPrepayment(
          "fg-1",
          "lid-1",
          { mode: "reduce_installment", amount: "100000000" },
          NOW,
        ),
      ).toEqual({
        liabilityId: "lid-1",
        mode: "reduce_installment",
        prepaidPrincipal: "100000000",
        penaltyPercent: "1.00",
        penalty: "1000000",
        cashOutNow: "101000000",
        installmentBefore: "4546388",
        installmentAfter: "3409791",
        remainingMonthsBefore: 180,
        remainingMonthsAfter: 180,
        totalInterestBefore: "418349734",
        totalInterestAfter: "313762283",
        interestSaved: "104587451",
        netSaving: "103587451",
        assumesCurrentFloatingRate: false,
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.liability.update).not.toHaveBeenCalled();
    });

    it("reduce tenor: 180 -> 102 months at the same installment", async () => {
      prisma.liability.findUnique.mockResolvedValue(AT_61);

      const preview = await service.previewPrepayment(
        "fg-1",
        "lid-1",
        { mode: "reduce_tenor", amount: "100000000", penaltyPercent: "1.00" },
        NOW,
      );

      expect(preview.installmentAfter).toBe("4546388");
      expect(preview.remainingMonthsAfter).toBe(102);
      expect(preview.interestSaved).toBe("255703278");
    });

    it("full payoff ignores amount and applies the penalty to the whole balance", async () => {
      prisma.liability.findUnique.mockResolvedValue(AT_61);

      const preview = await service.previewPrepayment(
        "fg-1",
        "lid-1",
        { mode: "full", penaltyPercent: "2.50" },
        NOW,
      );

      expect(preview.penalty).toBe("10000000");
      expect(preview.cashOutNow).toBe("410000000");
      expect(preview.remainingMonthsAfter).toBe(0);
    });

    it("berjenjang at #13: reduce tenor keeps the tier step-ups and flags the floating assumption", async () => {
      prisma.liabilityRatePeriod.findMany.mockResolvedValue(PERIOD_ROWS);
      prisma.liability.findUnique.mockResolvedValue({
        ...KPR,
        remainingBalance: 482_422_215n,
      });

      const preview = await service.previewPrepayment(
        "fg-1",
        "lid-1",
        { mode: "reduce_tenor", amount: "50000000" },
        new Date("2027-01-21T00:00:00.000Z"),
      );

      expect(preview.penalty).toBe("500000");
      expect(preview.remainingMonthsAfter).toBe(196);
      expect(preview.interestSaved).toBe("158148844");
      expect(preview.assumesCurrentFloatingRate).toBe(true);
    });

    it("review fix 1: an installment paid within the grace window previews from the NEXT period (shared with recordPrepayment)", async () => {
      prisma.liability.findUnique.mockResolvedValue(AT_61);
      prisma.transaction.findFirst.mockResolvedValue({ id: "tx-installment" });

      const preview = await service.previewPrepayment(
        "fg-1",
        "lid-1",
        { mode: "reduce_installment", amount: "100000000" },
        new Date("2026-01-17T00:00:00.000Z"),
      );

      expect(preview.installmentAfter).toBe("3409791");
      expect(preview.remainingMonthsBefore).toBe(180);
    });

    it("C1: #60 paid ON its own due day, prepay 6 days later — anchors at #61 (3.409.791/180), never the falsely-bumped #62 (3.417.306/179)", async () => {
      prisma.liability.findUnique.mockResolvedValue(AT_61);
      // #60's due day (AT_61: akad 2021-01-15) — before the instant #61
      // becomes due (2026-01-20T17:00Z WIB), so it must NOT count as #61 paid.
      const paidOnDueDay = new Date("2026-01-15T00:00:00.000Z");
      prisma.transaction.findFirst.mockImplementation(
        ({ where }: { where: { occurredAt: { gte: Date } } }) =>
          Promise.resolve(
            where.occurredAt.gte.getTime() <= paidOnDueDay.getTime()
              ? { id: "tx-60" }
              : null,
          ),
      );

      const preview = await service.previewPrepayment(
        "fg-1",
        "lid-1",
        { mode: "reduce_installment", amount: "100000000" },
        new Date("2026-01-21T00:00:00.000Z"),
      );

      expect(preview.installmentAfter).toBe("3409791");
      expect(preview.remainingMonthsBefore).toBe(180);
    });

    it("C1 reverse: a payment for the due installment made near a month boundary is still detected across calendar months", async () => {
      // akad on the 31st so #60's due day (2026-01-31) and the prepayment
      // (2026-02-02, still in grace) fall in DIFFERENT calendar months —
      // the old "any payment this calendar month" check would miss it.
      const startDate = new Date("2021-01-31T00:00:00.000Z");
      prisma.liability.findUnique.mockResolvedValue({
        ...AT_61,
        startDate,
      });
      const paidOnDueDay = new Date("2026-01-31T00:00:00.000Z");
      prisma.transaction.findFirst.mockImplementation(
        ({ where }: { where: { occurredAt: { gte: Date } } }) =>
          Promise.resolve(
            where.occurredAt.gte.getTime() <= paidOnDueDay.getTime()
              ? { id: "tx-60" }
              : null,
          ),
      );

      const preview = await service.previewPrepayment(
        "fg-1",
        "lid-1",
        { mode: "reduce_installment", amount: "100000000" },
        new Date("2026-02-02T00:00:00.000Z"),
      );

      // due-by-date alone is still #60 (2 days late); the payment already
      // recorded for #60 bumps the anchor to #61 (240 - 61 + 1 = 180).
      expect(preview.remainingMonthsBefore).toBe(180);
    });

    it.each([
      ["no amount on a partial prepayment", { mode: "reduce_tenor" as const }],
      [
        "an amount above the balance",
        { mode: "reduce_tenor" as const, amount: "400000001" },
      ],
      ["a zero amount", { mode: "reduce_installment" as const, amount: "0" }],
      [
        "a penalty above 10%",
        { mode: "full" as const, penaltyPercent: "10.01" },
      ],
    ])("400: %s", async (_label, query) => {
      prisma.liability.findUnique.mockResolvedValue(AT_61);

      await expect(
        service.previewPrepayment("fg-1", "lid-1", query, NOW),
      ).rejects.toThrow(BadRequestException);
    });

    it("400 for a liability that is neither anuitas nor flat", async () => {
      prisma.liability.findUnique.mockResolvedValue({
        ...AT_61,
        interestMethod: "efektif",
      });

      await expect(
        service.previewPrepayment("fg-1", "lid-1", { mode: "full" }, NOW),
      ).rejects.toThrow(BadRequestException);
    });

    it("404 for a liability of another family (tenant-scoped lookup)", async () => {
      prisma.liability.findUnique.mockResolvedValue(null);

      await expect(
        service.previewPrepayment("fg-2", "lid-1", { mode: "full" }, NOW),
      ).rejects.toThrow("Liability not found");
      expect(prisma.liability.findUnique).toHaveBeenCalledWith({
        where: { id: "lid-1", familyGroupId: "fg-2" },
      });
    });
  });

  describe("prepayment persistence (installmentFromPeriod, guard exception)", () => {
    // State after recording 100 jt reduce-tenor at #61 on the berjenjang loan:
    // installment 4.869.889 kept from #61, tenor 60 + 106 = 166. NOW is six
    // days after #60 fell due, so #61 is the installment being paid.
    const PREPAID = {
      ...KPR,
      remainingBalance: 328_462_235n,
      installmentAmount: 4_869_889n,
      minimumPayment: 4_869_889n,
      tenorMonths: 166,
      installmentFromPeriod: 61,
    };
    const NOW = new Date("2031-01-21T00:00:00.000Z");

    beforeEach(() => {
      prisma.liabilityRatePeriod.findMany.mockResolvedValue(PERIOD_ROWS);
    });

    it("schedule and Pay preset use the stored installment from its anchor period", async () => {
      prisma.liability.findUnique.mockResolvedValue(PREPAID);
      prisma.liability.findMany.mockResolvedValue([PREPAID]);

      const schedule = await service.getSchedule("fg-1", "lid-1", NOW);
      const [dto] = await service.findAll("fg-1", NOW);

      expect(schedule.rows[0]).toEqual({
        period: 61,
        installment: "4869889",
        interest: "3010904",
        principal: "1858985",
        remaining: "326603250",
      });
      expect(schedule.rows).toHaveLength(106);
      expect(schedule.rows[105]?.period).toBe(166);
      expect(dto?.currentInstallmentAmount).toBe("4869889");
    });

    it("without the anchor the same row would be re-annuitised (the column is really read)", async () => {
      prisma.liability.findUnique.mockResolvedValue({
        ...PREPAID,
        installmentFromPeriod: null,
      });

      const schedule = await service.getSchedule("fg-1", "lid-1", NOW);

      expect(schedule.rows[0]?.installment).toBe("4857320");
    });

    it("a notes-only PATCH keeps the anchor and the prepaid installment", async () => {
      prisma.liability.findUnique.mockResolvedValue(PREPAID);
      prisma.liability.findUniqueOrThrow.mockResolvedValue(PREPAID);
      prisma.liability.update.mockResolvedValue(PREPAID);

      await service.update("fg-1", "lid-1", { notes: "cek" }, NOW);

      expect(prisma.liability.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            installmentAmount: 4_869_889n,
            installmentFromPeriod: 61,
          }),
        }),
      );
    });

    it.each([
      ["a tenor correction to 180 bln", { tenorMonths: 180 }, 4_524_568n],
      [
        "a floating-rate correction to 10.50%",
        {
          ratePeriods: [
            { kind: "fixed", months: 24, ratePercent: "3.50" },
            { kind: "fixed", months: 12, ratePercent: "5.50" },
            { kind: "floating", months: null, ratePercent: "10.50" },
          ],
        },
        4_767_352n,
      ],
    ])(
      "%s on a prepaid loan re-annuitises what is left from the installment now due (never totalDebt over the tenor)",
      async (_label, dto, installment) => {
        prisma.liability.findUnique.mockResolvedValue(PREPAID);
        prisma.liability.findUniqueOrThrow.mockResolvedValue(PREPAID);
        prisma.liability.update.mockResolvedValue(PREPAID);

        await service.update("fg-1", "lid-1", dto as never, NOW);

        // 328,462,235 left from #61: 180 - 61 + 1 = 120 months at 11.00%, or 106 months at 10.50%.
        expect(prisma.liability.update).toHaveBeenLastCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              installmentAmount: installment,
              minimumPayment: installment,
              installmentFromPeriod: 61,
            }),
          }),
        );
        expect(prisma.budget.upsert).toHaveBeenLastCalledWith(
          expect.objectContaining({
            update: expect.objectContaining({ limitAmount: installment }),
          }),
        );
      },
    );

    it("a term change a prepaid loan cannot be re-annuitised under (switch to flat) is refused", async () => {
      const legacyPrepaid = {
        ...PREPAID,
        fixedRateMonths: null,
        floatingRate: null,
      };
      prisma.liabilityRatePeriod.findMany.mockResolvedValue([]);
      prisma.liability.findUnique.mockResolvedValue(legacyPrepaid);
      prisma.liability.findUniqueOrThrow.mockResolvedValue(legacyPrepaid);

      await expect(
        service.update(
          "fg-1",
          "lid-1",
          { interestMethod: "flat" as never },
          NOW,
        ),
      ).rejects.toThrow("pelunasan dipercepat");
      expect(prisma.liability.update).not.toHaveBeenCalled();
    });

    it("prepayment rows are ignored by the installment guard and by paidThisPeriod", async () => {
      prisma.liability.findMany.mockResolvedValue([PREPAID]);
      await service.findAll("fg-1", NOW);
      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            accountId: { not: null },
            liabilityPrepaymentId: null,
          }),
        }),
      );

      prisma.liability.findUnique.mockResolvedValue(PREPAID);
      prisma.account.findUnique.mockResolvedValue({
        id: "acc-1",
        familyGroupId: "fg-1",
        type: "bank",
        balance: 50_000_000n,
        name: "BCA",
      });
      prisma.category.findFirst.mockResolvedValueOnce({ id: "cat-interest" });
      prisma.liability.update.mockResolvedValue(PREPAID);
      await service.pay(
        "fg-1",
        "lid-1",
        { sourceAccountId: "acc-1", amount: "4869889" },
        NOW,
      );
      expect(prisma.transaction.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            liabilityId: "lid-1",
            accountId: { not: null },
            liabilityPrepaymentId: null,
          }),
        }),
      );
    });
  });

  describe("recordPrepayment", () => {
    // Single-rate 11% KPR, akad 2021-01-15: 2026-01-21 is six days after #60 fell due, so #61 (180 left) is being paid.
    const AT_61 = {
      ...KPR,
      interestRate: { toString: () => "11.00" },
      remainingBalance: 400_000_000n,
      installmentAmount: 4_546_388n,
      minimumPayment: 4_546_388n,
      startDate: new Date("2021-01-15T00:00:00.000Z"),
      kprScheme: null,
      installmentFromPeriod: null,
    };
    const NOW = new Date("2026-01-21T00:00:00.000Z");
    const KEY = "0b6f3f0e-8c1d-4a55-9e2f-3c5d7a9b1e20";
    const BCA = {
      id: "acc-1",
      familyGroupId: "fg-1",
      type: "bank",
      balance: 500_000_000n,
      name: "BCA",
    };
    const RECORDED = {
      id: "pp-1",
      familyGroupId: "fg-1",
      liabilityId: "lid-1",
      idempotencyKey: KEY,
      mode: "reduce_installment",
      principalAmount: 100_000_000n,
      penaltyPercent: { toString: () => "1.00" },
      penaltyAmount: 1_000_000n,
      sourceAccountId: "acc-1",
      effectivePeriod: 61,
      installmentBefore: 4_546_388n,
      installmentAfter: 3_409_791n,
      tenorMonthsBefore: 240,
      tenorMonthsAfter: 240,
      createdByUserId: "user-1",
      occurredAt: NOW,
      createdAt: NOW,
    };

    function arrange(row: object = AT_61, account: object = BCA) {
      prisma.liability.findUnique.mockResolvedValue(row);
      prisma.account.findUnique.mockResolvedValue(account);
      prisma.coaAccount.findFirst
        .mockResolvedValueOnce({ id: "coa-5", name: "Utang" })
        .mockResolvedValueOnce({
          id: "coa-20011",
          name: "Penalti Pelunasan Pinjaman",
        });
      prisma.category.findFirst
        .mockResolvedValueOnce({ id: "cat-prepay", coaAccountId: "coa-5" })
        .mockResolvedValueOnce({
          id: "cat-penalty",
          coaAccountId: "coa-20011",
        });
      prisma.liabilityPrepayment.create.mockImplementation(
        ({ data }: { data: object }) =>
          Promise.resolve({ id: "pp-1", createdAt: NOW, ...data }),
      );
      prisma.liability.update.mockResolvedValue(row);
    }
    const record = (
      body: object,
      userId: string | null = "user-1",
      now: Date = NOW,
    ) =>
      service.recordPrepayment(
        "fg-1",
        "lid-1",
        { sourceAccountId: "acc-1", idempotencyKey: KEY, ...body } as never,
        userId,
        now,
      );

    it("reduce installment: debits principal + penalty, books both legs, persists 3.409.791 from #61", async () => {
      arrange();

      const res = await record({
        mode: "reduce_installment",
        amount: "100000000",
      });

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: "acc-1", familyGroupId: "fg-1" },
        data: { balance: { decrement: 101_000_000n } },
      });
      expect(prisma.liability.update).toHaveBeenCalledWith({
        where: { id: "lid-1", familyGroupId: "fg-1" },
        data: {
          remainingBalance: { decrement: 100_000_000n },
          installmentAmount: 3_409_791n,
          minimumPayment: 3_409_791n,
          installmentFromPeriod: 61,
        },
      });
      expect(prisma.liabilityPrepayment.create).toHaveBeenCalledWith({
        data: {
          familyGroupId: "fg-1",
          liabilityId: "lid-1",
          idempotencyKey: KEY,
          mode: "reduce_installment",
          principalAmount: 100_000_000n,
          penaltyPercent: "1.00",
          penaltyAmount: 1_000_000n,
          sourceAccountId: "acc-1",
          effectivePeriod: 61,
          installmentBefore: 4_546_388n,
          installmentAfter: 3_409_791n,
          tenorMonthsBefore: 240,
          tenorMonthsAfter: 240,
          createdByUserId: "user-1",
          occurredAt: NOW,
        },
      });
      expect(prisma.transaction.create).toHaveBeenNthCalledWith(1, {
        data: {
          familyGroupId: "fg-1",
          accountId: "acc-1",
          categoryId: "cat-prepay",
          amount: 100_000_000n,
          type: "transfer",
          liabilityId: "lid-1",
          liabilityPrepaymentId: "pp-1",
          description: "Pelunasan dipercepat KPR BTN",
          occurredAt: NOW,
        },
      });
      expect(prisma.transaction.create).toHaveBeenNthCalledWith(2, {
        data: {
          familyGroupId: "fg-1",
          accountId: "acc-1",
          categoryId: "cat-penalty",
          amount: 1_000_000n,
          type: "expense",
          liabilityId: "lid-1",
          liabilityPrepaymentId: "pp-1",
          description: "Penalti pelunasan KPR BTN",
          occurredAt: NOW,
        },
      });
      expect(prisma.budget.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ limitAmount: 3_409_791n }),
        }),
      );
      expect(res.replayed).toBe(false);
      expect(res.prepayment).toEqual({
        id: "pp-1",
        mode: "reduce_installment",
        principalAmount: "100000000",
        penaltyPercent: "1.00",
        penaltyAmount: "1000000",
        effectivePeriod: 61,
        installmentBefore: "4546388",
        installmentAfter: "3409791",
        tenorMonthsBefore: 240,
        tenorMonthsAfter: 240,
        occurredAt: NOW.toISOString(),
      });
    });

    it("reduce tenor: installment kept, tenor 240 -> 162, and the schedule read back has 102 rows", async () => {
      arrange();

      await record({ mode: "reduce_tenor", amount: "100000000" });

      expect(prisma.liability.update).toHaveBeenCalledWith({
        where: { id: "lid-1", familyGroupId: "fg-1" },
        data: {
          remainingBalance: { decrement: 100_000_000n },
          installmentAmount: 4_546_388n,
          minimumPayment: 4_546_388n,
          installmentFromPeriod: 61,
          tenorMonths: 162,
        },
      });
      expect(prisma.budget.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ limitAmount: 4_546_388n }),
        }),
      );

      prisma.liability.findUnique.mockResolvedValue({
        ...AT_61,
        remainingBalance: 300_000_000n,
        tenorMonths: 162,
        installmentFromPeriod: 61,
      });
      const schedule = await service.getSchedule("fg-1", "lid-1", NOW);
      expect(schedule.rows).toHaveLength(102);
      expect(schedule.rows[0]?.installment).toBe("4546388");
      expect(schedule.rows[101]?.remaining).toBe("0");
    });

    it("full payoff at 2.5%: debits 410.000.000, zeroes the obligation and removes the budget line", async () => {
      arrange();

      const res = await record({ mode: "full", penaltyPercent: "2.50" });

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: "acc-1", familyGroupId: "fg-1" },
        data: { balance: { decrement: 410_000_000n } },
      });
      expect(prisma.liability.update).toHaveBeenCalledWith({
        where: { id: "lid-1", familyGroupId: "fg-1" },
        data: {
          remainingBalance: { decrement: 400_000_000n },
          minimumPayment: 0n,
          // Review fix 4 — the stale installment/anchor must not survive a full payoff.
          installmentAmount: null,
          installmentFromPeriod: null,
        },
      });
      expect(prisma.budget.deleteMany).toHaveBeenCalledWith({
        where: { familyGroupId: "fg-1", liabilityId: "lid-1" },
      });
      expect(res.prepayment.installmentAfter).toBeNull();
      expect(res.prepayment.penaltyAmount).toBe("10000000");
    });

    // fix-round1 (Important) — a FULL prepayment brings remainingBalance
    // to 0 (the DB actually applies the `decrement`, unlike `arrange()`'s
    // canned mock above), and that lunas state must null `nextDueDate` —
    // otherwise `resolveDueAnchorPeriod` still clamps to the settled
    // tenor period and /liabilitas shows a real due date + red banner
    // forever after a full prepayment.
    it("full payoff: nextDueDate is null once remainingBalance is actually 0", async () => {
      arrange();
      prisma.liability.update.mockResolvedValue({
        ...AT_61,
        remainingBalance: 0n,
        minimumPayment: 0n,
        installmentAmount: null,
        installmentFromPeriod: null,
      });

      const res = await record({ mode: "full", penaltyPercent: "2.50" });

      expect(res.liability.nextDueDate).toBeNull();
    });

    it("zero penalty books no penalty leg", async () => {
      arrange();

      await record({
        mode: "reduce_tenor",
        amount: "100000000",
        penaltyPercent: "0",
      });

      expect(prisma.transaction.create).toHaveBeenCalledTimes(1);
    });

    it("replay: the same idempotencyKey returns the first record and writes nothing", async () => {
      arrange();
      prisma.liabilityPrepayment.findFirst.mockResolvedValue(RECORDED);

      const res = await record({
        mode: "reduce_installment",
        amount: "100000000",
      });

      expect(prisma.liabilityPrepayment.findFirst).toHaveBeenCalledWith({
        where: {
          familyGroupId: "fg-1",
          liabilityId: "lid-1",
          idempotencyKey: KEY,
        },
      });
      expect(res.replayed).toBe(true);
      expect(res.prepayment.id).toBe("pp-1");
      expect(prisma.account.update).not.toHaveBeenCalled();
      expect(prisma.transaction.create).not.toHaveBeenCalled();
      expect(prisma.liabilityPrepayment.create).not.toHaveBeenCalled();
    });

    it("review fix 3: 409 when the same idempotencyKey is replayed with a different request body", async () => {
      arrange();
      prisma.liabilityPrepayment.findFirst.mockResolvedValue(RECORDED);

      await expect(
        record({ mode: "reduce_installment", amount: "200000000" }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.liability.update).not.toHaveBeenCalled();
    });

    it("concurrent double submit: the loser's P2002 retries into a replay, never a second debit or a 500", async () => {
      arrange();
      prisma.liabilityPrepayment.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(RECORDED);
      prisma.liabilityPrepayment.create.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "test",
        }),
      );

      const res = await record({
        mode: "reduce_installment",
        amount: "100000000",
      });

      expect(res.replayed).toBe(true);
      expect(prisma.liabilityPrepayment.create).toHaveBeenCalledTimes(1);
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it("guard exception: an installment already paid this month does not block a prepayment, and correctly bumps the anchor past it (C1)", async () => {
      arrange();
      prisma.transaction.findFirst.mockResolvedValue({ id: "tx-installment" });

      const res = await record({ mode: "reduce_tenor", amount: "100000000" });

      expect(res.replayed).toBe(false);
      expect(prisma.liabilityPrepayment.create).toHaveBeenCalled();
      // due (at NOW=2026-01-21) is #61; the mocked payment bumps to #62.
      expect(res.prepayment.effectivePeriod).toBe(62);
      expect(prisma.transaction.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            occurredAt: { gte: new Date("2026-01-20T17:00:00.000Z") },
          }),
        }),
      );
    });

    it("review fix 1: an installment paid within the grace window anchors to the NEXT period, not the late one still due by date", async () => {
      arrange();
      prisma.transaction.findFirst.mockResolvedValue({ id: "tx-installment" });

      const res = await record(
        { mode: "reduce_installment", amount: "100000000" },
        "user-1",
        new Date("2026-01-17T00:00:00.000Z"),
      );

      expect(res.prepayment.effectivePeriod).toBe(61);
      expect(res.prepayment.installmentAfter).toBe("3409791");
      expect(prisma.liability.update).toHaveBeenCalledWith({
        where: { id: "lid-1", familyGroupId: "fg-1" },
        data: {
          remainingBalance: { decrement: 100_000_000n },
          installmentAmount: 3_409_791n,
          minimumPayment: 3_409_791n,
          installmentFromPeriod: 61,
        },
      });
    });

    it("review fix 1: the same correction applies to reduce-tenor (persists tenor 162, not 161)", async () => {
      arrange();
      prisma.transaction.findFirst.mockResolvedValue({ id: "tx-installment" });

      await record(
        { mode: "reduce_tenor", amount: "100000000" },
        "user-1",
        new Date("2026-01-17T00:00:00.000Z"),
      );

      expect(prisma.liability.update).toHaveBeenCalledWith({
        where: { id: "lid-1", familyGroupId: "fg-1" },
        data: {
          remainingBalance: { decrement: 100_000_000n },
          installmentAmount: 4_546_388n,
          minimumPayment: 4_546_388n,
          installmentFromPeriod: 61,
          tenorMonths: 162,
        },
      });
    });

    it("C1: #60 paid ON its own due day, prepay 6 days later — reduce-tenor persists tenor 162 from #61, never the falsely-bumped 163 from #62", async () => {
      arrange();
      const paidOnDueDay = new Date("2026-01-15T00:00:00.000Z");
      prisma.transaction.findFirst.mockImplementation(
        ({ where }: { where: { occurredAt: { gte: Date } } }) =>
          Promise.resolve(
            where.occurredAt.gte.getTime() <= paidOnDueDay.getTime()
              ? { id: "tx-60" }
              : null,
          ),
      );

      await record(
        { mode: "reduce_tenor", amount: "100000000" },
        "user-1",
        new Date("2026-01-21T00:00:00.000Z"),
      );

      expect(prisma.liability.update).toHaveBeenCalledWith({
        where: { id: "lid-1", familyGroupId: "fg-1" },
        data: {
          remainingBalance: { decrement: 100_000_000n },
          installmentAmount: 4_546_388n,
          minimumPayment: 4_546_388n,
          installmentFromPeriod: 61,
          tenorMonths: 162,
        },
      });
    });

    it.each([
      ["no amount on a partial prepayment", { mode: "reduce_tenor" }],
      ["an amount on a full payoff", { mode: "full", amount: "1" }],
      [
        "an amount above the balance",
        { mode: "reduce_tenor", amount: "400000001" },
      ],
      ["a zero amount", { mode: "reduce_installment", amount: "0" }],
      ["a penalty above 10%", { mode: "full", penaltyPercent: "10.01" }],
    ])("400: %s", async (_label, body) => {
      arrange();

      await expect(record(body)).rejects.toThrow(BadRequestException);
      expect(prisma.account.update).not.toHaveBeenCalled();
    });

    it("400 when the bank account cannot cover principal + penalty (overdraft floor)", async () => {
      arrange(AT_61, { ...BCA, balance: 100_500_000n });

      await expect(
        record({ mode: "reduce_tenor", amount: "100000000" }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.account.update).not.toHaveBeenCalled();
    });

    it("400 for a liability that is neither anuitas nor flat", async () => {
      arrange({ ...AT_61, interestMethod: "efektif" });

      await expect(record({ mode: "full" })).rejects.toThrow(
        BadRequestException,
      );
    });

    it("404 for another family's liability or source account (tenant-scoped lookups)", async () => {
      arrange();
      prisma.liability.findUnique.mockResolvedValueOnce(null);
      await expect(record({ mode: "full" })).rejects.toThrow(
        "Liability not found",
      );

      prisma.account.findUnique.mockResolvedValueOnce(null);
      await expect(record({ mode: "full" })).rejects.toThrow(
        "Account acc-1 not found",
      );
      expect(prisma.account.findUnique).toHaveBeenCalledWith({
        where: { id: "acc-1", familyGroupId: "fg-1" },
      });
    });

    it("409 when a user's own category already uses the prepayment name on another COA", async () => {
      arrange();
      prisma.category.findFirst.mockReset();
      prisma.category.findFirst.mockResolvedValueOnce({
        id: "cat-user",
        coaAccountId: "coa-other",
      });

      await expect(
        record({ mode: "reduce_tenor", amount: "100000000" }),
      ).rejects.toThrow("Pelunasan Dipercepat Pinjaman");
    });
  });
});
