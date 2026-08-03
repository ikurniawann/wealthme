import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";
import { TransactionsService } from "../transactions/transactions.service";

import { AllowanceRequestsService } from "./allowance-requests.service";

const FAMILY_GROUP_ID = "fg-1";
const OWNER_USER_ID = "user-owner";
const MEMBER_USER_ID = "user-member";
const TARGET_ACCOUNT_ID = "account-target";
const MASTER_ACCOUNT_ID = "account-master";
const REQUEST_ID = "request-1";

function makePrisma() {
  return {
    account: { findUnique: jest.fn() },
    allowanceRequest: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    notification: { create: jest.fn() },
  };
}

function makeTransactionsService() {
  return { create: jest.fn().mockResolvedValue({ id: "tx-1" }) };
}

describe("AllowanceRequestsService", () => {
  let service: AllowanceRequestsService;
  let prisma: ReturnType<typeof makePrisma>;
  let transactionsService: ReturnType<typeof makeTransactionsService>;

  beforeEach(async () => {
    prisma = makePrisma();
    transactionsService = makeTransactionsService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AllowanceRequestsService,
        { provide: PrismaService, useValue: prisma },
        { provide: TransactionsService, useValue: transactionsService },
      ],
    }).compile();
    service = module.get(AllowanceRequestsService);
  });

  describe("create", () => {
    it("rejects requesting funding for an account the caller does not own", async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: TARGET_ACCOUNT_ID,
        familyGroupId: FAMILY_GROUP_ID,
        ownerUserId: "someone-else",
      });

      await expect(
        service.create(FAMILY_GROUP_ID, MEMBER_USER_ID, {
          targetAccountId: TARGET_ACCOUNT_ID,
          amount: 100000,
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.allowanceRequest.create).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the target account does not exist in this family group", async () => {
      prisma.account.findUnique.mockResolvedValue(null);

      await expect(
        service.create(FAMILY_GROUP_ID, MEMBER_USER_ID, {
          targetAccountId: TARGET_ACCOUNT_ID,
          amount: 100000,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("creates a pending request and notifies the family group when the caller owns the account", async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: TARGET_ACCOUNT_ID,
        familyGroupId: FAMILY_GROUP_ID,
        ownerUserId: MEMBER_USER_ID,
      });
      prisma.allowanceRequest.create.mockResolvedValue({
        id: REQUEST_ID,
        familyGroupId: FAMILY_GROUP_ID,
        requesterUserId: MEMBER_USER_ID,
        targetAccountId: TARGET_ACCOUNT_ID,
        fromAccountId: null,
        amount: BigInt(100000),
        note: "Uang jajan",
        status: "pending",
        createdAt: new Date(),
        decidedAt: null,
        decidedByUserId: null,
        requester: { name: "Anak Pertama" },
        targetAccount: { name: "Rekening Anak" },
        fromAccount: null,
        decidedByUser: null,
      });

      const result = await service.create(FAMILY_GROUP_ID, MEMBER_USER_ID, {
        targetAccountId: TARGET_ACCOUNT_ID,
        amount: 100000,
        note: "Uang jajan",
      });

      expect(prisma.allowanceRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            familyGroupId: FAMILY_GROUP_ID,
            requesterUserId: MEMBER_USER_ID,
            targetAccountId: TARGET_ACCOUNT_ID,
            amount: BigInt(100000),
            note: "Uang jajan",
          }),
        }),
      );
      expect(prisma.notification.create).toHaveBeenCalled();
      expect(result.status).toBe("pending");
      expect(result.amount).toBe("100000");
    });
  });

  describe("findAll", () => {
    const rows = [
      {
        id: "req-mine",
        familyGroupId: FAMILY_GROUP_ID,
        requesterUserId: MEMBER_USER_ID,
        targetAccountId: TARGET_ACCOUNT_ID,
        fromAccountId: null,
        amount: BigInt(1000),
        note: null,
        status: "pending",
        createdAt: new Date(),
        decidedAt: null,
        decidedByUserId: null,
      },
      {
        id: "req-someone-else",
        familyGroupId: FAMILY_GROUP_ID,
        requesterUserId: "someone-else",
        targetAccountId: "account-other",
        fromAccountId: null,
        amount: BigInt(2000),
        note: null,
        status: "pending",
        createdAt: new Date(),
        decidedAt: null,
        decidedByUserId: null,
      },
    ];

    it("returns only the caller's own requests when canSeeAll is false (member)", async () => {
      prisma.allowanceRequest.findMany.mockImplementation(
        ({ where }: { where: { requesterUserId?: string } }) =>
          Promise.resolve(
            rows.filter(
              (r) =>
                where.requesterUserId === undefined ||
                r.requesterUserId === where.requesterUserId,
            ),
          ),
      );

      const result = await service.findAll(
        FAMILY_GROUP_ID,
        MEMBER_USER_ID,
        false,
      );

      expect(result.map((r) => r.id)).toEqual(["req-mine"]);
      expect(prisma.allowanceRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            familyGroupId: FAMILY_GROUP_ID,
            requesterUserId: MEMBER_USER_ID,
          },
        }),
      );
    });

    it("returns every request in the family group when canSeeAll is true (owner/admin_staff)", async () => {
      prisma.allowanceRequest.findMany.mockResolvedValue(rows);

      const result = await service.findAll(
        FAMILY_GROUP_ID,
        OWNER_USER_ID,
        true,
      );

      expect(result.map((r) => r.id).sort()).toEqual(
        ["req-mine", "req-someone-else"].sort(),
      );
    });

    it("orders pending requests first", async () => {
      prisma.allowanceRequest.findMany.mockResolvedValue([
        { ...rows[1], status: "approved" },
        { ...rows[0], status: "pending" },
      ]);

      const result = await service.findAll(
        FAMILY_GROUP_ID,
        OWNER_USER_ID,
        true,
      );

      expect(result[0]?.status).toBe("pending");
    });
  });

  describe("approve", () => {
    const pendingRequest = {
      id: REQUEST_ID,
      familyGroupId: FAMILY_GROUP_ID,
      requesterUserId: MEMBER_USER_ID,
      targetAccountId: TARGET_ACCOUNT_ID,
      fromAccountId: null,
      amount: BigInt(150000),
      note: "Uang jajan",
      status: "pending" as const,
      createdAt: new Date(),
      decidedAt: null,
      decidedByUserId: null,
    };

    it("throws NotFoundException when the request does not exist", async () => {
      prisma.allowanceRequest.findFirst.mockResolvedValue(null);

      await expect(
        service.approve(FAMILY_GROUP_ID, REQUEST_ID, OWNER_USER_ID, {
          fromAccountId: MASTER_ACCOUNT_ID,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("rejects deciding an already-decided request", async () => {
      prisma.allowanceRequest.findFirst.mockResolvedValue({
        ...pendingRequest,
        status: "approved",
      });

      await expect(
        service.approve(FAMILY_GROUP_ID, REQUEST_ID, OWNER_USER_ID, {
          fromAccountId: MASTER_ACCOUNT_ID,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a source account that matches the target account", async () => {
      prisma.allowanceRequest.findFirst.mockResolvedValue(pendingRequest);

      await expect(
        service.approve(FAMILY_GROUP_ID, REQUEST_ID, OWNER_USER_ID, {
          fromAccountId: TARGET_ACCOUNT_ID,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(transactionsService.create).not.toHaveBeenCalled();
    });

    it("executes a REAL transfer via TransactionsService and marks the request approved", async () => {
      prisma.allowanceRequest.findFirst.mockResolvedValue(pendingRequest);
      prisma.account.findUnique.mockResolvedValue({
        id: MASTER_ACCOUNT_ID,
        familyGroupId: FAMILY_GROUP_ID,
      });
      prisma.allowanceRequest.update.mockResolvedValue({
        ...pendingRequest,
        status: "approved",
        fromAccountId: MASTER_ACCOUNT_ID,
        decidedAt: new Date(),
        decidedByUserId: OWNER_USER_ID,
        targetAccount: { name: "Rekening Anak" },
      });

      const result = await service.approve(
        FAMILY_GROUP_ID,
        REQUEST_ID,
        OWNER_USER_ID,
        { fromAccountId: MASTER_ACCOUNT_ID },
      );

      expect(transactionsService.create).toHaveBeenCalledWith(
        FAMILY_GROUP_ID,
        expect.objectContaining({
          accountId: MASTER_ACCOUNT_ID,
          toAccountId: TARGET_ACCOUNT_ID,
          amount: 150000,
          type: "transfer",
        }),
      );
      expect(prisma.allowanceRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: REQUEST_ID },
          data: expect.objectContaining({
            status: "approved",
            fromAccountId: MASTER_ACCOUNT_ID,
            decidedByUserId: OWNER_USER_ID,
          }),
        }),
      );
      expect(prisma.notification.create).toHaveBeenCalled();
      expect(result.status).toBe("approved");
    });
  });

  describe("reject", () => {
    const pendingRequest = {
      id: REQUEST_ID,
      familyGroupId: FAMILY_GROUP_ID,
      requesterUserId: MEMBER_USER_ID,
      targetAccountId: TARGET_ACCOUNT_ID,
      fromAccountId: null,
      amount: BigInt(150000),
      note: null,
      status: "pending" as const,
      createdAt: new Date(),
      decidedAt: null,
      decidedByUserId: null,
    };

    it("rejects deciding an already-decided request", async () => {
      prisma.allowanceRequest.findFirst.mockResolvedValue({
        ...pendingRequest,
        status: "rejected",
      });

      await expect(
        service.reject(FAMILY_GROUP_ID, REQUEST_ID, OWNER_USER_ID, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it("marks the request rejected without touching account balances", async () => {
      prisma.allowanceRequest.findFirst.mockResolvedValue(pendingRequest);
      prisma.allowanceRequest.update.mockResolvedValue({
        ...pendingRequest,
        status: "rejected",
        decidedAt: new Date(),
        decidedByUserId: OWNER_USER_ID,
        targetAccount: { name: "Rekening Anak" },
      });

      const result = await service.reject(
        FAMILY_GROUP_ID,
        REQUEST_ID,
        OWNER_USER_ID,
        { reason: "Belum waktunya" },
      );

      expect(transactionsService.create).not.toHaveBeenCalled();
      expect(prisma.allowanceRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "rejected",
            decidedByUserId: OWNER_USER_ID,
          }),
        }),
      );
      expect(prisma.notification.create).toHaveBeenCalled();
      expect(result.status).toBe("rejected");
    });
  });
});
