import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";

import { InsurancesService } from "./insurances.service";

const FAMILY_GROUP_ID = "fg-1";
const INSURANCE_ID = "ins-1";

const BASE_ROW = {
  id: INSURANCE_ID,
  familyGroupId: FAMILY_GROUP_ID,
  name: "Asuransi Jiwa",
  provider: "Prudential",
  type: "jiwa",
  status: "aktif",
  coverageAmount: BigInt(1_000_000_000),
  premiumAmount: BigInt(1_500_000),
  premiumPeriod: "monthly",
  renewalDate: null,
  policyNumber: "POL-001",
  notes: null,
  currency: "IDR",
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
  beneficiaries: [] as unknown[],
};

// The service calls `this.prisma.$transaction(async (tx) => ...)` for
// update() — supply a `tx` proxy that delegates back to the same mocked
// delegates so nested calls inside the callback are observable on the mocks.
let prismaTx: {
  insurance: { update: jest.Mock; findUnique: jest.Mock; create: jest.Mock };
  insuranceBeneficiary: { deleteMany: jest.Mock };
  account: { findUnique: jest.Mock; update: jest.Mock };
  category: {
    findFirst: jest.Mock;
    create: jest.Mock;
    findUniqueOrThrow: jest.Mock;
  };
  coaAccount: { findFirst: jest.Mock; update: jest.Mock };
  budget: { upsert: jest.Mock };
  transaction: { create: jest.Mock };
};

function makePrisma() {
  return {
    insurance: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    insuranceBeneficiary: {
      deleteMany: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
    member: {
      findFirst: jest.fn(),
    },
    // EPIC-023 E1 — used inside pay()'s $transaction.
    account: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    category: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    coaAccount: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    // EPIC-023 E2 — used inside create()'s $transaction and remove()'s
    // read-only guard.
    budget: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prismaTx)),
  };
}

describe("InsurancesService", () => {
  let service: InsurancesService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    prismaTx = {
      insurance: {
        update: prisma.insurance.update,
        findUnique: prisma.insurance.findUnique,
        create: prisma.insurance.create,
      },
      insuranceBeneficiary: {
        deleteMany: prisma.insuranceBeneficiary.deleteMany,
      },
      account: {
        findUnique: prisma.account.findUnique,
        update: prisma.account.update,
      },
      category: {
        findFirst: prisma.category.findFirst,
        create: prisma.category.create,
        findUniqueOrThrow: prisma.category.findUniqueOrThrow,
      },
      coaAccount: {
        findFirst: prisma.coaAccount.findFirst,
        update: prisma.coaAccount.update,
      },
      budget: { upsert: prisma.budget.upsert },
      transaction: { create: prisma.transaction.create },
    };
    jest.clearAllMocks();
    // EPIC-023 E2 — safe default for every test that calls create() but
    // does not care about the auto-budget side-effect: the premium
    // category already exists, so resolvePremiumCategoryId() short-circuits
    // without needing a COA account mocked too. Tests exercising the
    // self-heal / delete-guard paths override this explicitly.
    prisma.category.findFirst.mockResolvedValue({ id: "cat-premium" });
    prisma.category.findUniqueOrThrow.mockResolvedValue({
      coaAccountId: "coa-premium",
    });
    prisma.transaction.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InsurancesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<InsurancesService>(InsurancesService);
  });

  describe("getSummary()", () => {
    it("counts only active policies", async () => {
      // Arrange
      prisma.insurance.findMany.mockResolvedValue([
        {
          status: "aktif",
          premiumAmount: BigInt(500_000),
          premiumPeriod: "monthly",
        },
        {
          status: "tidak_aktif",
          premiumAmount: BigInt(200_000),
          premiumPeriod: "monthly",
        },
        {
          status: "kadaluarsa",
          premiumAmount: BigInt(100_000),
          premiumPeriod: "monthly",
        },
      ]);

      // Act
      const result = await service.getSummary(FAMILY_GROUP_ID);

      // Assert
      expect(result.activePolicies).toBe(1);
    });

    it("sums monthly premiums including quarterly and yearly normalization", async () => {
      // Arrange — monthly 600k + quarterly 900k/3=300k + yearly 1200k/12=100k = 1_000_000
      prisma.insurance.findMany.mockResolvedValue([
        {
          status: "aktif",
          premiumAmount: BigInt(600_000),
          premiumPeriod: "monthly",
        },
        {
          status: "aktif",
          premiumAmount: BigInt(900_000),
          premiumPeriod: "quarterly",
        },
        {
          status: "aktif",
          premiumAmount: BigInt(1_200_000),
          premiumPeriod: "yearly",
        },
      ]);

      // Act
      const result = await service.getSummary(FAMILY_GROUP_ID);

      // Assert
      expect(result.totalMonthlyPremium).toBe("1000000");
      expect(result.currency).toBe("IDR");
    });

    it("returns zero totals for empty list", async () => {
      // Arrange
      prisma.insurance.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getSummary(FAMILY_GROUP_ID);

      // Assert
      expect(result.activePolicies).toBe(0);
      expect(result.totalMonthlyPremium).toBe("0");
    });
  });

  describe("findAll()", () => {
    it("maps daysUntilRenewal to null when renewalDate is absent", async () => {
      // Arrange
      prisma.insurance.findMany.mockResolvedValue([
        { ...BASE_ROW, renewalDate: null },
      ]);

      // Act
      const [item] = await service.findAll(FAMILY_GROUP_ID);

      // Assert
      expect(item!.daysUntilRenewal).toBeNull();
    });

    it("computes positive daysUntilRenewal for a future date", async () => {
      // Arrange — renewal 10 days from now
      const future = new Date(Date.now() + 10 * 86_400_000);
      prisma.insurance.findMany.mockResolvedValue([
        { ...BASE_ROW, renewalDate: future },
      ]);

      // Act
      const [item] = await service.findAll(FAMILY_GROUP_ID);

      // Assert
      expect(item!.daysUntilRenewal).toBeGreaterThan(0);
      expect(item!.daysUntilRenewal).toBeLessThanOrEqual(10);
    });
  });

  describe("paidThisPeriod", () => {
    it("is true when a premium payment landed this month", async () => {
      prisma.insurance.findMany.mockResolvedValue([{ ...BASE_ROW }]);
      prisma.transaction.findMany.mockResolvedValue([
        { insuranceId: INSURANCE_ID },
      ]);
      const [item] = await service.findAll(FAMILY_GROUP_ID);
      expect(item!.paidThisPeriod).toBe(true);
    });

    it("is false when no premium payment landed this month", async () => {
      prisma.insurance.findMany.mockResolvedValue([{ ...BASE_ROW }]);
      prisma.transaction.findMany.mockResolvedValue([]);
      const [item] = await service.findAll(FAMILY_GROUP_ID);
      expect(item!.paidThisPeriod).toBe(false);
    });
  });

  describe("create()", () => {
    beforeEach(() => {
      // EPIC-023 E2 — every create() with a non-zero premium now resolves
      // (self-heals) the shared premium category; default to "already
      // exists" so pre-existing tests that don't care about the budget
      // side-effect stay focused on their own assertion.
      prisma.category.findFirst.mockResolvedValue({ id: "cat-premium" });
      prisma.category.findUniqueOrThrow.mockResolvedValue({
        coaAccountId: "coa-premium",
      });
    });

    it("returns InsuranceResponseDto with stringified amounts", async () => {
      // Arrange
      prisma.insurance.create.mockResolvedValue({ ...BASE_ROW });

      // Act
      const result = await service.create(FAMILY_GROUP_ID, {
        name: "Asuransi Jiwa",
        type: "jiwa" as const,
        premiumAmount: "1500000",
      });

      // Assert
      expect(result.id).toBe(INSURANCE_ID);
      expect(result.premiumAmount).toBe("1500000");
      expect(result.coverageAmount).toBe("1000000000");
      expect(result.daysUntilRenewal).toBeNull();
    });

    it("does NOT create notification when renewalDate is more than 30 days away", async () => {
      // Arrange — renewal 60 days from now
      const farFuture = new Date(Date.now() + 60 * 86_400_000);
      prisma.insurance.create.mockResolvedValue({
        ...BASE_ROW,
        renewalDate: farFuture,
      });

      // Act
      await service.create(FAMILY_GROUP_ID, {
        name: "Asuransi Jiwa",
        type: "jiwa" as const,
        premiumAmount: "1500000",
        renewalDate: farFuture.toISOString(),
      });

      // Wait for fire-and-forget
      await new Promise((r) => setTimeout(r, 0));

      // Assert
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    // EPIC-023 E2 (D11) — a non-zero monthly-normalised premium
    // auto-creates the FIXED budget line for this policy's shared premium
    // category.
    it("auto-creates a FIXED budget line for a monthly premium", async () => {
      prisma.insurance.create.mockResolvedValue({ ...BASE_ROW });

      await service.create(FAMILY_GROUP_ID, {
        name: "Asuransi Jiwa",
        type: "jiwa" as const,
        premiumAmount: "1500000",
        premiumPeriod: "monthly" as const,
      });

      expect(prisma.coaAccount.update).toHaveBeenCalledWith({
        where: { id: "coa-premium" },
        data: { budgetType: "FIXED" },
      });
      expect(prisma.budget.upsert).toHaveBeenCalledWith({
        where: {
          familyGroupId_categoryId_period: {
            familyGroupId: FAMILY_GROUP_ID,
            categoryId: "cat-premium",
            period: "monthly",
          },
        },
        create: {
          familyGroupId: FAMILY_GROUP_ID,
          categoryId: "cat-premium",
          period: "monthly",
          limitAmount: BigInt(1_500_000),
          insuranceId: INSURANCE_ID,
        },
        update: { limitAmount: { increment: BigInt(1_500_000) } },
      });
    });

    it("normalises a yearly premium to its monthly contribution", async () => {
      prisma.insurance.create.mockResolvedValue({
        ...BASE_ROW,
        premiumAmount: BigInt(12_000_000),
        premiumPeriod: "yearly",
      });

      await service.create(FAMILY_GROUP_ID, {
        name: "Asuransi Jiwa",
        type: "jiwa" as const,
        premiumAmount: "12000000",
        premiumPeriod: "yearly" as const,
      });

      expect(prisma.budget.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ limitAmount: BigInt(1_000_000) }),
        }),
      );
    });
  });

  describe("remove()", () => {
    it("throws NotFoundException when insurance does not exist", async () => {
      // Arrange
      prisma.insurance.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.remove(FAMILY_GROUP_ID, "nonexistent-id"),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.insurance.delete).not.toHaveBeenCalled();
    });

    it("deletes when no FIXED budget line exists for the premium category", async () => {
      prisma.insurance.findUnique.mockResolvedValue(BASE_ROW);
      prisma.category.findFirst.mockResolvedValue(null);

      await service.remove(FAMILY_GROUP_ID, INSURANCE_ID);

      expect(prisma.insurance.delete).toHaveBeenCalledWith({
        where: { id: INSURANCE_ID, familyGroupId: FAMILY_GROUP_ID },
      });
    });

    // EPIC-023 E2 (D11, Honesty AC) — refused with a message naming the
    // blocking budget line, never a silent cascade.
    it("refuses (409) when a FIXED budget line still references the premium category", async () => {
      prisma.insurance.findUnique.mockResolvedValue(BASE_ROW);
      prisma.category.findFirst.mockResolvedValue({
        id: "cat-premium",
        name: "Premi Asuransi",
      });
      prisma.budget.findUnique.mockResolvedValue({
        id: "budget-1",
        limitAmount: BigInt(1_500_000),
      });

      await expect(
        service.remove(FAMILY_GROUP_ID, INSURANCE_ID),
      ).rejects.toThrow(/Premi Asuransi/);
      expect(prisma.insurance.delete).not.toHaveBeenCalled();
    });
  });

  // EPIC-021 Group D (#14) — beneficiaries mirror InheritanceHeir's rules:
  // optional, and percentages may be partially allocated (sum <= 100).
  describe("beneficiaries", () => {
    it("accepts beneficiaries whose percentages sum to exactly 100", async () => {
      // Arrange
      prisma.insurance.create.mockResolvedValue({ ...BASE_ROW });

      // Act & Assert — should not throw
      await expect(
        service.create(FAMILY_GROUP_ID, {
          name: "Asuransi Jiwa",
          type: "jiwa" as const,
          premiumAmount: "1500000",
          beneficiaries: [
            { name: "Anak 1", relationship: "Anak", sharePercent: 60 },
            { name: "Anak 2", relationship: "Anak", sharePercent: 40 },
          ],
        }),
      ).resolves.toBeDefined();
    });

    it("accepts beneficiaries whose percentages sum to less than 100 (partial allocation)", async () => {
      // Arrange
      prisma.insurance.create.mockResolvedValue({ ...BASE_ROW });

      // Act & Assert — should not throw
      await expect(
        service.create(FAMILY_GROUP_ID, {
          name: "Asuransi Jiwa",
          type: "jiwa" as const,
          premiumAmount: "1500000",
          beneficiaries: [
            { name: "Anak 1", relationship: "Anak", sharePercent: 30 },
          ],
        }),
      ).resolves.toBeDefined();
    });

    it("rejects beneficiaries whose percentages sum to more than 100", async () => {
      // Act & Assert
      await expect(
        service.create(FAMILY_GROUP_ID, {
          name: "Asuransi Jiwa",
          type: "jiwa" as const,
          premiumAmount: "1500000",
          beneficiaries: [
            { name: "Anak 1", relationship: "Anak", sharePercent: 70 },
            { name: "Anak 2", relationship: "Anak", sharePercent: 50 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.insurance.create).not.toHaveBeenCalled();
    });

    it("persists a beneficiary's optional memberUserId link", async () => {
      // Arrange
      prisma.member.findFirst.mockResolvedValue({
        id: "member-1",
        userId: "user-5",
        familyGroupId: FAMILY_GROUP_ID,
      });
      prisma.insurance.create.mockResolvedValue({
        ...BASE_ROW,
        beneficiaries: [
          {
            id: "ben-1",
            insuranceId: INSURANCE_ID,
            name: "Anak 1",
            relationship: "Anak",
            sharePercent: { toString: () => "60.00" },
            memberUserId: "user-5",
            createdAt: new Date("2024-01-01T00:00:00.000Z"),
          },
        ],
      });

      // Act
      const result = await service.create(FAMILY_GROUP_ID, {
        name: "Asuransi Jiwa",
        type: "jiwa" as const,
        premiumAmount: "1500000",
        beneficiaries: [
          {
            name: "Anak 1",
            relationship: "Anak",
            sharePercent: 60,
            memberUserId: "user-5",
          },
        ],
      });

      // Assert
      expect(result.beneficiaries[0]!.memberUserId).toBe("user-5");
      expect(prisma.member.findFirst).toHaveBeenCalledWith({
        where: { userId: "user-5", familyGroupId: FAMILY_GROUP_ID },
      });
    });

    // TS review fix #1 — memberUserId must be tenant-validated the same way
    // as warisan heirs.
    it("rejects a beneficiary memberUserId that does not belong to the family group", async () => {
      // Arrange — member not found (cross-tenant or unknown user)
      prisma.member.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.create(FAMILY_GROUP_ID, {
          name: "Asuransi Jiwa",
          type: "jiwa" as const,
          premiumAmount: "1500000",
          beneficiaries: [
            {
              name: "Anak 1",
              relationship: "Anak",
              sharePercent: 60,
              memberUserId: "someone-elses-user-id",
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.insurance.create).not.toHaveBeenCalled();
    });

    it("rejects an update whose beneficiary percentages sum to more than 100", async () => {
      // Arrange
      prisma.insurance.findUnique.mockResolvedValue({ ...BASE_ROW });

      // Act & Assert
      await expect(
        service.update(FAMILY_GROUP_ID, INSURANCE_ID, {
          beneficiaries: [
            { name: "Anak 1", relationship: "Anak", sharePercent: 80 },
            { name: "Anak 2", relationship: "Anak", sharePercent: 30 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.insurance.update).not.toHaveBeenCalled();
    });

    it("rejects an update whose beneficiary memberUserId does not belong to the family group", async () => {
      // Arrange
      prisma.insurance.findUnique.mockResolvedValue({ ...BASE_ROW });
      prisma.member.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.update(FAMILY_GROUP_ID, INSURANCE_ID, {
          beneficiaries: [
            {
              name: "Anak 1",
              relationship: "Anak",
              sharePercent: 60,
              memberUserId: "cross-tenant-user",
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.insurance.update).not.toHaveBeenCalled();
    });
  });

  // EPIC-021 Group D (#13) — "pendidikan" round-trips as itself instead of
  // being coerced to "lainnya".
  describe("pendidikan type", () => {
    it("persists and returns type=pendidikan unchanged", async () => {
      // Arrange
      prisma.insurance.create.mockResolvedValue({
        ...BASE_ROW,
        type: "pendidikan",
      });

      // Act
      const result = await service.create(FAMILY_GROUP_ID, {
        name: "Asuransi Pendidikan Anak",
        type: "pendidikan" as const,
        premiumAmount: "500000",
      });

      // Assert
      expect(result.type).toBe("pendidikan");
      expect(prisma.insurance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: "pendidikan" }),
        }),
      );
    });
  });

  // EPIC-023 E1 — paying a premium creates ONE linked (insuranceId)
  // transaction, debits the source account, and advances renewalDate by one
  // premium period. All inside `pay()`'s one `$transaction`.
  describe("pay", () => {
    const POLICY = {
      ...BASE_ROW,
      premiumAmount: BigInt(1_500_000),
      premiumPeriod: "monthly" as const,
      renewalDate: new Date("2026-03-15T00:00:00.000Z"),
    };
    const ACCOUNT = {
      id: "acc-1",
      familyGroupId: FAMILY_GROUP_ID,
      type: "bank",
      balance: BigInt(10_000_000),
      name: "BCA",
    };

    it("throws NotFoundException when the policy does not exist in this family group", async () => {
      prisma.insurance.findUnique.mockResolvedValue(null);
      await expect(
        service.pay(FAMILY_GROUP_ID, "missing-id", {
          sourceAccountId: "acc-1",
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.account.update).not.toHaveBeenCalled();
    });

    it("rejects a source account from another family group (tenant scoping)", async () => {
      prisma.insurance.findUnique.mockResolvedValue(POLICY);
      prisma.account.findUnique.mockResolvedValue(null);

      await expect(
        service.pay(FAMILY_GROUP_ID, INSURANCE_ID, {
          sourceAccountId: "acc-other-family",
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.account.update).not.toHaveBeenCalled();
      expect(prisma.insurance.update).not.toHaveBeenCalled();
    });

    it("defaults amount to the policy's premiumAmount, debits the account, links insuranceId, and advances renewalDate by one period", async () => {
      prisma.insurance.findUnique.mockResolvedValue(POLICY);
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
      prisma.category.findFirst.mockResolvedValue({ id: "cat-premium" });
      prisma.insurance.update.mockResolvedValue({
        ...POLICY,
        renewalDate: new Date("2026-04-15T00:00:00.000Z"),
      });

      const result = await service.pay(FAMILY_GROUP_ID, INSURANCE_ID, {
        sourceAccountId: "acc-1",
      });

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: "acc-1", familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { decrement: BigInt(1_500_000) } },
      });
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            familyGroupId: FAMILY_GROUP_ID,
            accountId: "acc-1",
            categoryId: "cat-premium",
            amount: BigInt(1_500_000),
            type: "expense",
            insuranceId: INSURANCE_ID,
          }),
        }),
      );
      // Golden value — same clamped-advance algorithm as
      // next-renewal-date.util.spec.ts's "advances a mid-month date by one
      // month" case: 2026-03-15 monthly -> 2026-04-15.
      expect(prisma.insurance.update).toHaveBeenCalledWith({
        where: { id: INSURANCE_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { renewalDate: new Date("2026-04-15T00:00:00.000Z") },
      });
      expect(result.renewalDate).toBe("2026-04-15T00:00:00.000Z");
    });

    it("uses an explicit amount instead of the policy's premiumAmount when provided", async () => {
      prisma.insurance.findUnique.mockResolvedValue(POLICY);
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
      prisma.category.findFirst.mockResolvedValue({ id: "cat-premium" });
      prisma.insurance.update.mockResolvedValue(POLICY);

      await service.pay(FAMILY_GROUP_ID, INSURANCE_ID, {
        sourceAccountId: "acc-1",
        amount: "2000000",
      });

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: "acc-1", familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { decrement: BigInt(2_000_000) } },
      });
    });

    it("leaves renewalDate untouched when the policy has none set", async () => {
      prisma.insurance.findUnique.mockResolvedValue({
        ...POLICY,
        renewalDate: null,
      });
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
      prisma.category.findFirst.mockResolvedValue({ id: "cat-premium" });
      prisma.insurance.update.mockResolvedValue({
        ...POLICY,
        renewalDate: null,
      });

      await service.pay(FAMILY_GROUP_ID, INSURANCE_ID, {
        sourceAccountId: "acc-1",
      });

      expect(prisma.insurance.update).toHaveBeenCalledWith({
        where: { id: INSURANCE_ID, familyGroupId: FAMILY_GROUP_ID },
        data: {},
      });
    });

    it("self-heals by creating the premium expense category when none exists yet", async () => {
      prisma.insurance.findUnique.mockResolvedValue(POLICY);
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
      prisma.category.findFirst.mockResolvedValue(null);
      prisma.coaAccount.findFirst.mockResolvedValue({
        id: "coa-other-expense",
        code: "20099",
        name: "Pengeluaran Lainnya",
      });
      prisma.category.create.mockResolvedValue({ id: "cat-new-premium" });
      prisma.insurance.update.mockResolvedValue(POLICY);

      await service.pay(FAMILY_GROUP_ID, INSURANCE_ID, {
        sourceAccountId: "acc-1",
      });

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {
          familyGroupId: FAMILY_GROUP_ID,
          name: "Pengeluaran Lainnya",
          kind: "expense",
          coaAccountId: "coa-other-expense",
        },
      });
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ categoryId: "cat-new-premium" }),
        }),
      );
    });

    // HIGH — EPIC-021 #22's bank-overdraft floor must apply to insurance
    // premium payments exactly like every other fresh debit.
    it("rejects a payment from a bank account whose balance would go below zero (EPIC-021 #22)", async () => {
      prisma.insurance.findUnique.mockResolvedValue(POLICY);
      prisma.account.findUnique.mockResolvedValue({
        ...ACCOUNT,
        balance: BigInt(1_000_000),
      });

      await expect(
        service.pay(FAMILY_GROUP_ID, INSURANCE_ID, {
          sourceAccountId: "acc-1",
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.account.update).not.toHaveBeenCalled();
      expect(prisma.insurance.update).not.toHaveBeenCalled();
    });
  });
});
