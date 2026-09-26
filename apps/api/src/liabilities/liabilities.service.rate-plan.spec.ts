import { BadRequestException } from "@nestjs/common";
import { Test } from "@nestjs/testing";

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
      ["switching a planned KPR to flat", { interestMethod: "flat" as never }],
    ])("update refuses %s", async (_label, dto) => {
      withPeriods();
      prisma.liability.findUnique.mockResolvedValue(KPR);
      prisma.liability.findUniqueOrThrow.mockResolvedValue(KPR);

      await expect(service.update("fg-1", "lid-1", dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.liability.update).not.toHaveBeenCalled();
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

    it("400 for a liability that is not an anuitas loan", async () => {
      prisma.liability.findUnique.mockResolvedValue({
        ...AT_61,
        interestMethod: "flat",
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
});
