// KPR flat — user decision 2026-09-27: "flexible, ada yg flat ada yang
// anuitas". Syariah murabahah and some conventional KPR use one fixed
// margin/installment for the whole tenor instead of anuitas. This spec
// covers the KPR-specific wiring: create computes the flat installment,
// the schedule/pay paths (already generic in amortisation.util.ts, proven
// by kendaraan/pinjaman_pribadi elsewhere) work for type "kpr" too, and
// prepayment — previously rejected for every non-anuitas loan — now has a
// documented flat rule (see prepayment.util.ts's `flatReduceInstallment`
// doc comment): "reduce_installment" recomputes a fresh flat installment on
// the REMAINING principal over the SAME remaining tenor; "reduce_tenor"/
// "full" keep the ORIGINAL installment and shorten the tenor.
import { BadRequestException } from "@nestjs/common";
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
      findUniqueOrThrow: jest.fn(),
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

// Golden number (report): 300jt @ 8%/thn flat, 180 bln —
// (300,000,000 + 300,000,000*0.08*15) / 180 = 660,000,000 / 180 =
// 3,666,666.67 -> round-half-up = 3,666,667/bln.
const FLAT_KPR = {
  id: "lid-1",
  familyGroupId: "fg-1",
  name: "KPR Flat Muamalat",
  institution: "Bank Muamalat",
  type: "kpr",
  totalDebt: 300_000_000n,
  remainingBalance: 300_000_000n,
  minimumPayment: 3_666_667n,
  interestRate: { toString: () => "8.00" },
  dueDate: null,
  autoAdvanceDueDate: false,
  notes: null,
  currency: "IDR",
  interestMethod: "flat",
  tenorMonths: 180,
  startDate: new Date("2026-01-15T00:00:00.000Z"),
  installmentAmount: 3_666_667n,
  fixedRateMonths: null,
  floatingRate: null,
  kprScheme: "syariah_murabahah",
  principalCategoryId: "cat-principal",
  installmentFromPeriod: null,
  createdAt: new Date("2026-01-15T00:00:00.000Z"),
  updatedAt: new Date("2026-01-15T00:00:00.000Z"),
};
// The akad itself — the first installment (#1, 180 left) is being previewed/paid.
const AT_1 = new Date("2026-01-15T00:00:00.000Z");

describe("LiabilitiesService — KPR flat (Revisi K polish-j)", () => {
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

  describe("create", () => {
    it("golden number: 300jt @ 8%/thn flat over 180 bln computes installment 3.666.667", async () => {
      prisma.liability.create.mockImplementation(({ data }: { data: object }) =>
        Promise.resolve({ ...FLAT_KPR, ...data, principalCategoryId: null }),
      );
      prisma.coaAccount.findFirst.mockResolvedValue({
        id: "coa-5",
        code: "50001",
        name: "Utang",
      });
      prisma.category.create.mockResolvedValue({ id: "cat-principal" });
      prisma.category.findUniqueOrThrow.mockResolvedValue({
        coaAccountId: "coa-5",
      });

      const dto = await service.create("fg-1", {
        name: "KPR Flat Muamalat",
        type: "kpr" as never,
        totalDebt: "300000000",
        remainingBalance: "300000000",
        interestMethod: "flat" as never,
        interestRate: "8.00",
        tenorMonths: 180,
        startDate: AT_1.toISOString(),
        kprScheme: "syariah_murabahah" as never,
      });

      expect(dto.installmentAmount).toBe("3666667");
      expect(dto.interestMethod).toBe("flat");
      expect(prisma.liability.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            installmentAmount: 3_666_667n,
            minimumPayment: 3_666_667n,
            interestMethod: "flat",
            kprScheme: "syariah_murabahah",
          }),
        }),
      );
    });

    it("400: ratePeriods on a flat KPR is refused (rate plan is anuitas-only)", async () => {
      await expect(
        service.create("fg-1", {
          name: "KPR Flat",
          type: "kpr" as never,
          totalDebt: "300000000",
          remainingBalance: "300000000",
          interestMethod: "flat" as never,
          tenorMonths: 180,
          ratePeriods: [
            { kind: "fixed", months: null, ratePercent: "8.00" },
          ] as never,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.liability.create).not.toHaveBeenCalled();
    });

    it("400: fixedRateMonths/floatingRate on a flat KPR is refused (one fixed margin for the whole tenor)", async () => {
      await expect(
        service.create("fg-1", {
          name: "KPR Flat",
          type: "kpr" as never,
          totalDebt: "300000000",
          remainingBalance: "300000000",
          interestMethod: "flat" as never,
          tenorMonths: 180,
          fixedRateMonths: 36,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.liability.create).not.toHaveBeenCalled();
    });
  });

  describe("getSchedule", () => {
    it("equal installments (flat): row 1 and row 2 both 3.666.667, constant interest 2.000.000", async () => {
      prisma.liability.findUnique.mockResolvedValue(FLAT_KPR);

      const schedule = await service.getSchedule("fg-1", "lid-1", AT_1);

      expect(schedule.rows).toHaveLength(180);
      expect(schedule.rows[0]).toMatchObject({
        period: 1,
        installment: "3666667",
        interest: "2000000",
        principal: "1666667",
        remaining: "298333333",
      });
      expect(schedule.rows[1]).toMatchObject({
        period: 2,
        installment: "3666667",
        interest: "2000000",
      });
      expect(schedule.hasFloatingPeriod).toBe(false);
    });
  });

  describe("pay", () => {
    it("splits the golden installment into 2.000.000 interest / 1.666.667 principal", async () => {
      prisma.liability.findUnique.mockResolvedValue(FLAT_KPR);
      prisma.account.findUnique.mockResolvedValue({
        id: "acc-1",
        familyGroupId: "fg-1",
        type: "bank",
        balance: 50_000_000n,
        name: "BCA",
      });
      prisma.category.findFirst.mockResolvedValueOnce({ id: "cat-interest" });
      prisma.liability.update.mockResolvedValue({
        ...FLAT_KPR,
        remainingBalance: 298_333_333n,
      });

      const result = await service.pay(
        "fg-1",
        "lid-1",
        { sourceAccountId: "acc-1", amount: "3666667" } as never,
        AT_1,
      );

      expect(result.remainingBalance).toBe("298333333");
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: 1_666_667n }),
        }),
      );
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: 2_000_000n }),
        }),
      );
    });
  });

  describe("previewPrepayment — flat rule", () => {
    it("reduce_installment: recomputes a flat installment on the REMAINING principal over the SAME remaining tenor (2.444.444/180)", async () => {
      prisma.liability.findUnique.mockResolvedValue(FLAT_KPR);

      const preview = await service.previewPrepayment(
        "fg-1",
        "lid-1",
        { mode: "reduce_installment", amount: "100000000" },
        AT_1,
      );

      expect(preview.installmentBefore).toBe("3666667");
      expect(preview.installmentAfter).toBe("2444444");
      expect(preview.remainingMonthsBefore).toBe(180);
      expect(preview.remainingMonthsAfter).toBe(180);
      expect(preview.penalty).toBe("1000000");
      expect(preview.cashOutNow).toBe("101000000");
    });

    it("reduce_tenor: keeps the original installment (3.666.667), shortens tenor 180 -> 120", async () => {
      prisma.liability.findUnique.mockResolvedValue(FLAT_KPR);

      const preview = await service.previewPrepayment(
        "fg-1",
        "lid-1",
        { mode: "reduce_tenor", amount: "100000000" },
        AT_1,
      );

      expect(preview.installmentAfter).toBe("3666667");
      expect(preview.remainingMonthsAfter).toBe(120);
    });

    it("full payoff works for a flat KPR", async () => {
      prisma.liability.findUnique.mockResolvedValue(FLAT_KPR);

      const preview = await service.previewPrepayment(
        "fg-1",
        "lid-1",
        { mode: "full" },
        AT_1,
      );

      expect(preview.prepaidPrincipal).toBe("300000000");
      expect(preview.remainingMonthsAfter).toBe(0);
    });
  });

  describe("recordPrepayment — flat rule", () => {
    const KEY = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
    const BCA = {
      id: "acc-1",
      familyGroupId: "fg-1",
      type: "bank",
      balance: 500_000_000n,
      name: "BCA",
    };

    function arrange() {
      prisma.liability.findUnique.mockResolvedValue(FLAT_KPR);
      prisma.account.findUnique.mockResolvedValue(BCA);
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
          Promise.resolve({ id: "pp-1", createdAt: AT_1, ...data }),
      );
      prisma.liability.update.mockResolvedValue(FLAT_KPR);
    }

    it("reduce_installment persists 2.444.444 from period 1, debits principal + penalty", async () => {
      arrange();

      const res = await service.recordPrepayment(
        "fg-1",
        "lid-1",
        {
          sourceAccountId: "acc-1",
          idempotencyKey: KEY,
          mode: "reduce_installment",
          amount: "100000000",
        } as never,
        "user-1",
        AT_1,
      );

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: "acc-1", familyGroupId: "fg-1" },
        data: { balance: { decrement: 101_000_000n } },
      });
      expect(prisma.liability.update).toHaveBeenCalledWith({
        where: { id: "lid-1", familyGroupId: "fg-1" },
        data: {
          remainingBalance: { decrement: 100_000_000n },
          installmentAmount: 2_444_444n,
          minimumPayment: 2_444_444n,
          installmentFromPeriod: 1,
        },
      });
      expect(res.prepayment.installmentAfter).toBe("2444444");
    });

    it("reduce_tenor keeps the installment, persists tenor 120", async () => {
      arrange();

      const res = await service.recordPrepayment(
        "fg-1",
        "lid-1",
        {
          sourceAccountId: "acc-1",
          idempotencyKey: KEY,
          mode: "reduce_tenor",
          amount: "100000000",
        } as never,
        "user-1",
        AT_1,
      );

      expect(prisma.liability.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            installmentAmount: 3_666_667n,
            tenorMonths: 120,
          }),
        }),
      );
      expect(res.prepayment.tenorMonthsAfter).toBe(120);
    });
  });
});
