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
  insurance: { update: jest.Mock };
  insuranceBeneficiary: { deleteMany: jest.Mock };
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
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prismaTx)),
  };
}

describe("InsurancesService", () => {
  let service: InsurancesService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    prismaTx = {
      insurance: { update: prisma.insurance.update },
      insuranceBeneficiary: {
        deleteMany: prisma.insuranceBeneficiary.deleteMany,
      },
    };
    jest.clearAllMocks();

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

  describe("create()", () => {
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
});
