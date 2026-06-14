import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";

import { LiabilitiesService } from "./liabilities.service";

import type { TestingModule } from "@nestjs/testing";

const makePrisma = () => ({
  liability: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
});

const BASE = {
  id: "lid-1",
  familyGroupId: "fg-1",
  name: "KTA BNI",
  institution: "BNI",
  type: "pinjaman_pribadi",
  minimumPayment: BigInt(2_083_000),
  interestRate: { toString: () => "10.00" },
  dueDate: null,
  notes: null,
  currency: "IDR",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

describe("LiabilitiesService", () => {
  let service: LiabilitiesService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiabilitiesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(LiabilitiesService);
  });

  describe("paymentRatio", () => {
    it("computes 67% repayment when one-third remains", async () => {
      prisma.liability.findMany.mockResolvedValue([
        {
          ...BASE,
          totalDebt: BigInt(75_000_000),
          remainingBalance: BigInt(25_000_000),
        },
      ]);
      const [result] = await service.findAll("fg-1");
      expect(result.paymentRatio).toBe(67);
    });

    it("returns 0% when nothing has been paid", async () => {
      prisma.liability.findMany.mockResolvedValue([
        {
          ...BASE,
          totalDebt: BigInt(30_000_000),
          remainingBalance: BigInt(30_000_000),
        },
      ]);
      const [result] = await service.findAll("fg-1");
      expect(result.paymentRatio).toBe(0);
    });

    it("returns 100% when fully paid", async () => {
      prisma.liability.findMany.mockResolvedValue([
        { ...BASE, totalDebt: BigInt(10_000_000), remainingBalance: BigInt(0) },
      ]);
      const [result] = await service.findAll("fg-1");
      expect(result.paymentRatio).toBe(100);
    });

    it("returns 0% when totalDebt is zero (safe division)", async () => {
      prisma.liability.findMany.mockResolvedValue([
        { ...BASE, totalDebt: BigInt(0), remainingBalance: BigInt(0) },
      ]);
      const [result] = await service.findAll("fg-1");
      expect(result.paymentRatio).toBe(0);
    });
  });

  describe("getSummary", () => {
    it("sums remaining balances across multiple liabilities", async () => {
      prisma.liability.findMany.mockResolvedValue([
        { totalDebt: BigInt(30_000_000), remainingBalance: BigInt(8_170_000) },
        { totalDebt: BigInt(20_000_000), remainingBalance: BigInt(7_000_000) },
        { totalDebt: BigInt(75_000_000), remainingBalance: BigInt(25_000_000) },
      ]);
      const summary = await service.getSummary("fg-1");
      expect(summary.totalRemainingBalance).toBe("40170000");
      expect(summary.totalDebt).toBe("125000000");
    });

    it("returns zeros for empty list", async () => {
      prisma.liability.findMany.mockResolvedValue([]);
      const summary = await service.getSummary("fg-1");
      expect(summary.totalRemainingBalance).toBe("0");
      expect(summary.totalDebt).toBe("0");
    });
  });

  describe("create", () => {
    it("rejects non-numeric totalDebt", async () => {
      await expect(
        service.create("fg-1", {
          name: "Test",
          type: "kartu_kredit" as never,
          totalDebt: "abc",
          remainingBalance: "0",
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("remove", () => {
    it("throws NotFoundException when liability does not exist", async () => {
      prisma.liability.findUnique.mockResolvedValue(null);
      await expect(service.remove("fg-1", "missing-id")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
