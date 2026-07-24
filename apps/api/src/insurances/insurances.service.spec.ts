import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
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
};

function makePrisma() {
  return {
    insurance: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
  };
}

describe("InsurancesService", () => {
  let service: InsurancesService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
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

  describe("payPremium() — EPIC-016 Task H", () => {
    it("advances a monthly renewalDate by exactly one month", async () => {
      // Arrange
      const renewalDate = new Date("2026-08-01T00:00:00.000Z");
      const nextRenewalDate = new Date("2026-09-01T00:00:00.000Z");
      prisma.insurance.findUnique
        .mockResolvedValueOnce({
          ...BASE_ROW,
          premiumPeriod: "monthly",
          renewalDate,
        })
        .mockResolvedValueOnce({
          ...BASE_ROW,
          premiumPeriod: "monthly",
          renewalDate: nextRenewalDate,
        });
      prisma.insurance.updateMany.mockResolvedValue({ count: 1 });

      // Act
      const result = await service.payPremium(FAMILY_GROUP_ID, INSURANCE_ID);

      // Assert
      expect(prisma.insurance.updateMany).toHaveBeenCalledWith({
        where: {
          id: INSURANCE_ID,
          familyGroupId: FAMILY_GROUP_ID,
          renewalDate,
        },
        data: { renewalDate: nextRenewalDate },
      });
      expect(result.renewalDate).toBe("2026-09-01T00:00:00.000Z");
    });

    it("advances a quarterly renewalDate by 3 months in a single payment", async () => {
      // Arrange
      const renewalDate = new Date("2026-08-01T00:00:00.000Z");
      const nextRenewalDate = new Date("2026-11-01T00:00:00.000Z");
      prisma.insurance.findUnique
        .mockResolvedValueOnce({
          ...BASE_ROW,
          premiumPeriod: "quarterly",
          renewalDate,
        })
        .mockResolvedValueOnce({
          ...BASE_ROW,
          premiumPeriod: "quarterly",
          renewalDate: nextRenewalDate,
        });
      prisma.insurance.updateMany.mockResolvedValue({ count: 1 });

      // Act
      await service.payPremium(FAMILY_GROUP_ID, INSURANCE_ID);

      // Assert
      expect(prisma.insurance.updateMany).toHaveBeenCalledWith({
        where: {
          id: INSURANCE_ID,
          familyGroupId: FAMILY_GROUP_ID,
          renewalDate,
        },
        data: { renewalDate: nextRenewalDate },
      });
    });

    it("throws NotFoundException when insurance does not exist", async () => {
      // Arrange
      prisma.insurance.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.payPremium(FAMILY_GROUP_ID, "nonexistent-id"),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.insurance.updateMany).not.toHaveBeenCalled();
    });

    it("throws BadRequestException when the policy has no renewalDate", async () => {
      // Arrange
      prisma.insurance.findUnique.mockResolvedValue({
        ...BASE_ROW,
        renewalDate: null,
      });

      // Act & Assert
      await expect(
        service.payPremium(FAMILY_GROUP_ID, INSURANCE_ID),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.insurance.updateMany).not.toHaveBeenCalled();
    });

    it("throws ConflictException when a concurrent request already advanced the renewalDate", async () => {
      // Arrange — someone else already advanced renewalDate between our
      // read and write, so the conditional updateMany matches zero rows.
      const renewalDate = new Date("2026-08-01T00:00:00.000Z");
      prisma.insurance.findUnique.mockResolvedValueOnce({
        ...BASE_ROW,
        premiumPeriod: "monthly",
        renewalDate,
      });
      prisma.insurance.updateMany.mockResolvedValue({ count: 0 });

      // Act & Assert
      await expect(
        service.payPremium(FAMILY_GROUP_ID, INSURANCE_ID),
      ).rejects.toThrow(ConflictException);
      // Only the initial read happened — no second findUnique to fetch the
      // "updated" row, since we bail out before that.
      expect(prisma.insurance.findUnique).toHaveBeenCalledTimes(1);
    });
  });
});
