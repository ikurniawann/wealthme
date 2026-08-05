import {
  BadRequestException,
  ConflictException,
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
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      // SECURITY (TOCTOU) — the atomic claim guard; defaults to "claimed"
      // (count: 1) so tests that don't care about the race still pass.
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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

    function mockApprovedResult() {
      prisma.allowanceRequest.findUniqueOrThrow.mockResolvedValue({
        ...pendingRequest,
        status: "approved",
        fromAccountId: MASTER_ACCOUNT_ID,
        decidedAt: new Date(),
        decidedByUserId: OWNER_USER_ID,
        targetAccount: { name: "Rekening Anak" },
      });
    }

    it("throws NotFoundException when the request does not exist", async () => {
      prisma.allowanceRequest.findFirst.mockResolvedValue(null);

      await expect(
        service.approve(FAMILY_GROUP_ID, REQUEST_ID, OWNER_USER_ID, {
          fromAccountId: MASTER_ACCOUNT_ID,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("EPIC-023 Task D — rejects approving a funding request with no fromAccountId", async () => {
      prisma.allowanceRequest.findFirst.mockResolvedValue(pendingRequest);

      await expect(
        service.approve(FAMILY_GROUP_ID, REQUEST_ID, OWNER_USER_ID, {}),
      ).rejects.toThrow(BadRequestException);
      expect(transactionsService.create).not.toHaveBeenCalled();
      expect(prisma.allowanceRequest.updateMany).not.toHaveBeenCalled();
    });

    it("rejects a source account that matches the target account", async () => {
      prisma.allowanceRequest.findFirst.mockResolvedValue(pendingRequest);

      await expect(
        service.approve(FAMILY_GROUP_ID, REQUEST_ID, OWNER_USER_ID, {
          fromAccountId: TARGET_ACCOUNT_ID,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(transactionsService.create).not.toHaveBeenCalled();
      expect(prisma.allowanceRequest.updateMany).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the chosen source account does not exist", async () => {
      prisma.allowanceRequest.findFirst.mockResolvedValue(pendingRequest);
      prisma.account.findUnique.mockResolvedValue(null);

      await expect(
        service.approve(FAMILY_GROUP_ID, REQUEST_ID, OWNER_USER_ID, {
          fromAccountId: MASTER_ACCOUNT_ID,
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.allowanceRequest.updateMany).not.toHaveBeenCalled();
    });

    it("executes a REAL transfer via TransactionsService and marks the request approved", async () => {
      prisma.allowanceRequest.findFirst.mockResolvedValue(pendingRequest);
      prisma.account.findUnique.mockResolvedValue({
        id: MASTER_ACCOUNT_ID,
        familyGroupId: FAMILY_GROUP_ID,
      });
      prisma.allowanceRequest.updateMany.mockResolvedValue({ count: 1 });
      mockApprovedResult();

      const result = await service.approve(
        FAMILY_GROUP_ID,
        REQUEST_ID,
        OWNER_USER_ID,
        { fromAccountId: MASTER_ACCOUNT_ID },
      );

      // Claim happens BEFORE the transfer — atomic guard against a
      // concurrent decision, not a plain read-then-write.
      expect(prisma.allowanceRequest.updateMany).toHaveBeenCalledWith({
        where: {
          id: REQUEST_ID,
          familyGroupId: FAMILY_GROUP_ID,
          status: "pending",
        },
        data: expect.objectContaining({
          status: "approved",
          fromAccountId: MASTER_ACCOUNT_ID,
          decidedByUserId: OWNER_USER_ID,
        }),
      });
      expect(transactionsService.create).toHaveBeenCalledWith(
        FAMILY_GROUP_ID,
        expect.objectContaining({
          accountId: MASTER_ACCOUNT_ID,
          toAccountId: TARGET_ACCOUNT_ID,
          amount: 150000,
          type: "transfer",
        }),
      );
      expect(prisma.notification.create).toHaveBeenCalled();
      expect(result.status).toBe("approved");
    });

    // SECURITY (CRITICAL, TOCTOU) — double-approve must never execute two
    // real transfers. The atomic claim (updateMany WHERE status="pending")
    // is what prevents it: the second caller's claim matches zero rows.
    it("double-approve: the second concurrent approve gets 409 and never transfers", async () => {
      prisma.allowanceRequest.findFirst.mockResolvedValue(pendingRequest);
      prisma.account.findUnique.mockResolvedValue({
        id: MASTER_ACCOUNT_ID,
        familyGroupId: FAMILY_GROUP_ID,
      });
      // Simulates the row having already been claimed by a concurrent
      // approve() by the time THIS caller's updateMany runs.
      prisma.allowanceRequest.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.approve(FAMILY_GROUP_ID, REQUEST_ID, OWNER_USER_ID, {
          fromAccountId: MASTER_ACCOUNT_ID,
        }),
      ).rejects.toThrow(ConflictException);
      expect(transactionsService.create).not.toHaveBeenCalled();
    });

    // SECURITY (CRITICAL, TOCTOU) — an approve racing a reject (or vice
    // versa) must be mutually exclusive via the same claim guard.
    it("approve-vs-reject race: a claim that finds the row already decided gets 409", async () => {
      prisma.allowanceRequest.findFirst.mockResolvedValue(pendingRequest);
      prisma.account.findUnique.mockResolvedValue({
        id: MASTER_ACCOUNT_ID,
        familyGroupId: FAMILY_GROUP_ID,
      });
      // The row was rejected by a concurrent caller a moment earlier —
      // status is no longer "pending", so this claim matches 0 rows.
      prisma.allowanceRequest.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.approve(FAMILY_GROUP_ID, REQUEST_ID, OWNER_USER_ID, {
          fromAccountId: MASTER_ACCOUNT_ID,
        }),
      ).rejects.toThrow(ConflictException);
      expect(transactionsService.create).not.toHaveBeenCalled();
      expect(prisma.allowanceRequest.update).not.toHaveBeenCalled();
    });

    // SECURITY (CRITICAL) — if the transfer itself fails AFTER the claim
    // succeeded, the request must not be left stuck "approved" with no
    // actual money movement; it is compensated back to "pending".
    it("reverts the claim back to pending when the transfer fails", async () => {
      prisma.allowanceRequest.findFirst.mockResolvedValue(pendingRequest);
      prisma.account.findUnique.mockResolvedValue({
        id: MASTER_ACCOUNT_ID,
        familyGroupId: FAMILY_GROUP_ID,
      });
      prisma.allowanceRequest.updateMany.mockResolvedValue({ count: 1 });
      const transferError = new Error("insufficient funds");
      transactionsService.create.mockRejectedValue(transferError);

      await expect(
        service.approve(FAMILY_GROUP_ID, REQUEST_ID, OWNER_USER_ID, {
          fromAccountId: MASTER_ACCOUNT_ID,
        }),
      ).rejects.toThrow(transferError);

      expect(prisma.allowanceRequest.update).toHaveBeenCalledWith({
        where: { id: REQUEST_ID },
        data: {
          status: "pending",
          fromAccountId: null,
          decidedAt: null,
          decidedByUserId: null,
        },
      });
    });
  });

  // EPIC-023 Task D (D3/D9, US-FAM-14) — approving a held_expense request
  // replays the originally-attempted EXPENSE (never a transfer), moving the
  // balance for the FIRST time at approval, atomically, exactly once.
  describe("approve — held_expense (EPIC-023 Task D, D3/D9)", () => {
    const heldExpenseRequest = {
      id: REQUEST_ID,
      familyGroupId: FAMILY_GROUP_ID,
      requesterUserId: MEMBER_USER_ID,
      // See schema.prisma's AllowanceRequest comment — for held_expense
      // this is the account the deferred expense DEBITS.
      targetAccountId: TARGET_ACCOUNT_ID,
      fromAccountId: null,
      amount: BigInt(750000),
      note: null,
      kind: "held_expense" as const,
      categoryId: "cat-1",
      description: "Servis motor",
      status: "pending" as const,
      createdAt: new Date(),
      decidedAt: null,
      decidedByUserId: null,
    };

    function mockApprovedResult() {
      prisma.allowanceRequest.findUniqueOrThrow.mockResolvedValue({
        ...heldExpenseRequest,
        status: "approved",
        decidedAt: new Date(),
        decidedByUserId: OWNER_USER_ID,
        targetAccount: { name: "Rekening Anak" },
      });
    }

    it("posts the held expense (never a transfer) and needs no fromAccountId", async () => {
      prisma.allowanceRequest.findFirst.mockResolvedValue(heldExpenseRequest);
      prisma.allowanceRequest.updateMany.mockResolvedValue({ count: 1 });
      mockApprovedResult();

      const result = await service.approve(
        FAMILY_GROUP_ID,
        REQUEST_ID,
        OWNER_USER_ID,
        {},
      );

      expect(prisma.allowanceRequest.updateMany).toHaveBeenCalledWith({
        where: {
          id: REQUEST_ID,
          familyGroupId: FAMILY_GROUP_ID,
          status: "pending",
        },
        data: expect.objectContaining({
          status: "approved",
          decidedByUserId: OWNER_USER_ID,
        }),
      });
      // Real expense, on the held account, for the held amount — actingMember
      // null so TransactionsService's row-scope re-gate never re-holds this.
      expect(transactionsService.create).toHaveBeenCalledWith(
        FAMILY_GROUP_ID,
        expect.objectContaining({
          accountId: TARGET_ACCOUNT_ID,
          amount: 750000,
          type: "expense",
          categoryId: "cat-1",
          description: "Servis motor",
        }),
        null,
      );
      // Never a transfer — no toAccountId, no source-account resolution.
      expect(prisma.account.findUnique).not.toHaveBeenCalled();
      expect(result.status).toBe("approved");
      expect(result.kind).toBe("held_expense");
    });

    // SECURITY (CRITICAL, TOCTOU) — same double-approve guard as funding;
    // a held expense must never post twice.
    it("double-approve: the second concurrent approve gets 409 and never posts the expense", async () => {
      prisma.allowanceRequest.findFirst.mockResolvedValue(heldExpenseRequest);
      prisma.allowanceRequest.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.approve(FAMILY_GROUP_ID, REQUEST_ID, OWNER_USER_ID, {}),
      ).rejects.toThrow(ConflictException);
      expect(transactionsService.create).not.toHaveBeenCalled();
    });

    // SECURITY (CRITICAL) — if the replay fails after the claim succeeded,
    // compensate back to pending instead of leaving a stuck "approved" with
    // no actual posting.
    it("reverts the claim back to pending when replaying the expense fails", async () => {
      prisma.allowanceRequest.findFirst.mockResolvedValue(heldExpenseRequest);
      prisma.allowanceRequest.updateMany.mockResolvedValue({ count: 1 });
      const replayError = new Error("category not found");
      transactionsService.create.mockRejectedValue(replayError);

      await expect(
        service.approve(FAMILY_GROUP_ID, REQUEST_ID, OWNER_USER_ID, {}),
      ).rejects.toThrow(replayError);

      expect(prisma.allowanceRequest.update).toHaveBeenCalledWith({
        where: { id: REQUEST_ID },
        data: { status: "pending", decidedAt: null, decidedByUserId: null },
      });
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

    it("throws NotFoundException when the request does not exist", async () => {
      prisma.allowanceRequest.findFirst.mockResolvedValue(null);

      await expect(
        service.reject(FAMILY_GROUP_ID, REQUEST_ID, OWNER_USER_ID, {}),
      ).rejects.toThrow(NotFoundException);
    });

    // SECURITY (CRITICAL, TOCTOU) — same atomic-claim guard as approve();
    // a double-reject (or a reject racing an approve) must 409, not silently
    // overwrite the decision.
    it("double-decide: a claim that finds the row already decided gets 409", async () => {
      prisma.allowanceRequest.findFirst.mockResolvedValue(pendingRequest);
      prisma.allowanceRequest.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.reject(FAMILY_GROUP_ID, REQUEST_ID, OWNER_USER_ID, {}),
      ).rejects.toThrow(ConflictException);
    });

    it("marks the request rejected without touching account balances", async () => {
      prisma.allowanceRequest.findFirst.mockResolvedValue(pendingRequest);
      prisma.allowanceRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.allowanceRequest.findUniqueOrThrow.mockResolvedValue({
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
      expect(prisma.allowanceRequest.updateMany).toHaveBeenCalledWith({
        where: {
          id: REQUEST_ID,
          familyGroupId: FAMILY_GROUP_ID,
          status: "pending",
        },
        data: expect.objectContaining({
          status: "rejected",
          decidedByUserId: OWNER_USER_ID,
        }),
      });
      expect(prisma.notification.create).toHaveBeenCalled();
      expect(result.status).toBe("rejected");
    });

    // EPIC-023 Task D (D3/D9) — reject leaves balances untouched
    // PERMANENTLY, for a held expense exactly as for a funding request: no
    // Transaction is ever created, kind stays held_expense, decision final.
    it("EPIC-023 Task D — rejecting a held_expense request never posts the expense", async () => {
      const heldExpenseRequest = {
        id: REQUEST_ID,
        familyGroupId: FAMILY_GROUP_ID,
        requesterUserId: MEMBER_USER_ID,
        targetAccountId: TARGET_ACCOUNT_ID,
        fromAccountId: null,
        amount: BigInt(750000),
        note: null,
        kind: "held_expense" as const,
        categoryId: null,
        description: "Servis motor",
        status: "pending" as const,
        createdAt: new Date(),
        decidedAt: null,
        decidedByUserId: null,
      };
      prisma.allowanceRequest.findFirst.mockResolvedValue(heldExpenseRequest);
      prisma.allowanceRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.allowanceRequest.findUniqueOrThrow.mockResolvedValue({
        ...heldExpenseRequest,
        status: "rejected",
        decidedAt: new Date(),
        decidedByUserId: OWNER_USER_ID,
        targetAccount: { name: "Rekening Anak" },
      });

      const result = await service.reject(
        FAMILY_GROUP_ID,
        REQUEST_ID,
        OWNER_USER_ID,
        {},
      );

      expect(transactionsService.create).not.toHaveBeenCalled();
      expect(result.status).toBe("rejected");
      expect(result.kind).toBe("held_expense");
    });
  });
});
