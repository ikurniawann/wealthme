import { NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import { CATEGORIZATION_PORT } from "../categorization/categorization.port";
import { NOTIFICATION_SENDER_PORT } from "../notifications/notification-sender.port";
import { PrismaService } from "../prisma/prisma.service";

import { OCR_PORT } from "./ocr/ocr.port";
import { TransactionsService } from "./transactions.service";

const FAMILY_GROUP_ID = "fg-test-uuid";
const ACCOUNT_ID = "acc-test-uuid";

const mockAccount = { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID };

function makePrisma() {
  return {
    account: { findUnique: jest.fn(), update: jest.fn() },
    category: { findUnique: jest.fn(), findMany: jest.fn() },
    budget: { findFirst: jest.fn() },
    transaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      aggregate: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

describe("TransactionsService", () => {
  let service: TransactionsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: OCR_PORT, useValue: { extractFromBase64: jest.fn() } },
        {
          provide: CATEGORIZATION_PORT,
          useValue: { suggest: jest.fn().mockResolvedValue(null) },
        },
        { provide: NOTIFICATION_SENDER_PORT, useValue: { send: jest.fn() } },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  describe("create", () => {
    it("throws NotFoundException when accountId is not in the family group", async () => {
      prisma.account.findUnique.mockResolvedValue(null);

      await expect(
        service.create(FAMILY_GROUP_ID, {
          accountId: ACCOUNT_ID,
          amount: 50000,
          type: "expense",
          occurredAt: new Date().toISOString(),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("creates an expense transaction and returns DTO with correct fields", async () => {
      const now = new Date("2026-06-15T10:00:00.000Z");
      const createdTx = {
        id: "tx-uuid-1",
        familyGroupId: FAMILY_GROUP_ID,
        accountId: ACCOUNT_ID,
        categoryId: null,
        amount: BigInt(50000),
        type: "expense" as const,
        description: "Makan siang",
        occurredAt: now,
        createdAt: now,
      };

      prisma.account.findUnique.mockResolvedValue(mockAccount);
      prisma.category.findMany.mockResolvedValue([]);
      prisma.$transaction.mockImplementation(
        async (fn: Parameters<typeof prisma.$transaction>[0]) => {
          const innerPrisma = {
            ...prisma,
            transaction: {
              ...prisma.transaction,
              create: jest.fn().mockResolvedValue(createdTx),
            },
          };
          return (fn as (p: typeof innerPrisma) => Promise<unknown>)(
            innerPrisma,
          );
        },
      );

      const result = await service.create(FAMILY_GROUP_ID, {
        accountId: ACCOUNT_ID,
        amount: 50000,
        type: "expense",
        description: "Makan siang",
        occurredAt: now.toISOString(),
      });

      expect(result).toMatchObject({
        id: "tx-uuid-1",
        familyGroupId: FAMILY_GROUP_ID,
        accountId: ACCOUNT_ID,
        amount: "50000",
        type: "expense",
        description: "Makan siang",
      });
    });

    it("creates an income transaction with correct type", async () => {
      const now = new Date("2026-06-15T10:00:00.000Z");
      const createdTx = {
        id: "tx-uuid-2",
        familyGroupId: FAMILY_GROUP_ID,
        accountId: ACCOUNT_ID,
        categoryId: null,
        amount: BigInt(5000000),
        type: "income" as const,
        description: "Gaji bulan Juni",
        occurredAt: now,
        createdAt: now,
      };

      prisma.account.findUnique.mockResolvedValue(mockAccount);
      prisma.$transaction.mockImplementation(
        async (fn: Parameters<typeof prisma.$transaction>[0]) => {
          const innerPrisma = {
            ...prisma,
            transaction: {
              ...prisma.transaction,
              create: jest.fn().mockResolvedValue(createdTx),
            },
          };
          return (fn as (p: typeof innerPrisma) => Promise<unknown>)(
            innerPrisma,
          );
        },
      );

      const result = await service.create(FAMILY_GROUP_ID, {
        accountId: ACCOUNT_ID,
        amount: 5000000,
        type: "income",
        description: "Gaji bulan Juni",
        occurredAt: now.toISOString(),
      });

      expect(result.type).toBe("income");
      expect(result.amount).toBe("5000000");
    });
  });
});
