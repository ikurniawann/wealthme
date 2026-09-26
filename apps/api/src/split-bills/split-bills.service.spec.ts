import {
  BadRequestException,
  ConflictException,
  GoneException,
  NotFoundException,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Prisma } from "@prisma/client";

import { CryptoService } from "../crypto/crypto.service";
import { PrismaService } from "../prisma/prisma.service";

import { SplitBillsService } from "./split-bills.service";

import type { CreateSplitBillDto } from "./dto/create-split-bill.dto";
import type { TestingModule } from "@nestjs/testing";

/**
 * `$transaction` invokes its callback with the SAME mocked client — mirrors
 * liabilities.service.spec.ts / goals.service.spec.ts.
 */
function makePrisma() {
  const prisma = {
    splitBill: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    splitParticipant: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    account: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    coaAccount: {
      findFirst: jest.fn(),
    },
    category: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma),
  );
  return prisma;
}

const FAMILY_GROUP_ID = "fg-1";
const ACCOUNT = {
  id: "acc-payout",
  familyGroupId: FAMILY_GROUP_ID,
  name: "BCA Utama",
  institution: "BCA",
  maskedNumber: "•••• 1234",
  balance: BigInt(1_000_000),
};

const BILL = {
  id: "bill-1",
  familyGroupId: FAMILY_GROUP_ID,
  title: "Makan di Sushi Tei",
  totalAmount: BigInt(300_000),
  currency: "IDR",
  status: "open",
  notes: null,
  payoutAccountId: ACCOUNT.id,
  payoutInstructions: null,
  revokedAt: null,
  createdAt: new Date("2026-08-01"),
  updatedAt: new Date("2026-08-01"),
};

const PARTICIPANT = {
  id: "participant-1",
  splitBillId: BILL.id,
  name: "Budi",
  amountOwed: BigInt(100_000),
  status: "pending",
  shareToken: "share-token-budi",
  claimedAt: null,
  paidAt: null,
  settlementTransactionId: null,
  createdAt: new Date("2026-08-01"),
};

describe("SplitBillsService", () => {
  let service: SplitBillsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SplitBillsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: CryptoService,
          useValue: { decrypt: (v: string) => `dec(${v})` },
        },
      ],
    }).compile();

    service = module.get(SplitBillsService);
  });

  describe("create", () => {
    const dto: CreateSplitBillDto = {
      title: "Makan di Sushi Tei",
      totalAmount: 300_000,
      payoutAccountId: ACCOUNT.id,
      participants: [
        { name: "Andi", amountOwed: 150_000 },
        { name: "Budi", amountOwed: 150_000 },
      ],
    };

    it("rejects a payout account from another family group (tenant scoping)", async () => {
      prisma.account.findUnique.mockResolvedValue(null);

      await expect(service.create(FAMILY_GROUP_ID, dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.splitBill.create).not.toHaveBeenCalled();
    });

    it("rejects a mismatched participant sum before touching any table", async () => {
      await expect(
        service.create(FAMILY_GROUP_ID, {
          ...dto,
          participants: [{ name: "Andi", amountOwed: 100_000 }],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.account.findUnique).not.toHaveBeenCalled();
    });

    it("creates the bill with its nominated payout account", async () => {
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
      prisma.splitBill.create.mockResolvedValue({
        ...BILL,
        participants: [PARTICIPANT],
      });

      const result = await service.create(FAMILY_GROUP_ID, dto);

      expect(result.payoutAccountId).toBe(ACCOUNT.id);
      expect(prisma.splitBill.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ payoutAccountId: ACCOUNT.id }),
        }),
      );
    });
  });

  describe("updatePayoutAccount", () => {
    const OTHER_ACCOUNT = {
      ...ACCOUNT,
      id: "acc-other-group",
      familyGroupId: "fg-2",
    };

    it("updates the bill's payout account and returns it", async () => {
      prisma.splitBill.findUnique.mockResolvedValue(BILL);
      prisma.account.findUnique.mockResolvedValue(OTHER_ACCOUNT); // account belongs to fg-1 in reality, just reusing shape
      prisma.splitBill.update.mockResolvedValue({
        ...BILL,
        payoutAccountId: OTHER_ACCOUNT.id,
        participants: [PARTICIPANT],
      });

      const result = await service.updatePayoutAccount(
        FAMILY_GROUP_ID,
        BILL.id,
        {
          payoutAccountId: OTHER_ACCOUNT.id,
        },
      );

      expect(result.payoutAccountId).toBe(OTHER_ACCOUNT.id);
      expect(prisma.splitBill.update).toHaveBeenCalledWith({
        where: { id: BILL.id, familyGroupId: FAMILY_GROUP_ID },
        data: { payoutAccountId: OTHER_ACCOUNT.id },
        include: expect.anything(),
      });
    });

    it("throws NotFoundException when the bill is not in this family group", async () => {
      prisma.splitBill.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePayoutAccount(FAMILY_GROUP_ID, "other-bill", {
          payoutAccountId: ACCOUNT.id,
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.account.findUnique).not.toHaveBeenCalled();
      expect(prisma.splitBill.update).not.toHaveBeenCalled();
    });

    // Tenant-scoping proof — the target account belongs to a DIFFERENT
    // family group. `account.findUnique` is scoped by both id AND
    // familyGroupId (same convention as create()), so a cross-tenant
    // account id resolves to null and must be rejected.
    it("rejects a payout account that belongs to a different family group (tenant scoping)", async () => {
      prisma.splitBill.findUnique.mockResolvedValue(BILL);
      prisma.account.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePayoutAccount(FAMILY_GROUP_ID, BILL.id, {
          payoutAccountId: OTHER_ACCOUNT.id,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.account.findUnique).toHaveBeenCalledWith({
        where: { id: OTHER_ACCOUNT.id, familyGroupId: FAMILY_GROUP_ID },
      });
      expect(prisma.splitBill.update).not.toHaveBeenCalled();
    });
  });

  describe("getPublicParticipant", () => {
    it("returns only this participant's own share — no familyGroupId, bill id, or siblings", async () => {
      prisma.splitParticipant.findUnique.mockResolvedValue({
        ...PARTICIPANT,
        splitBill: BILL,
      });
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);

      const result = await service.getPublicParticipant(PARTICIPANT.shareToken);

      expect(result).toEqual({
        billTitle: BILL.title,
        participantName: PARTICIPANT.name,
        amountOwed: "100000",
        currency: "IDR",
        status: "pending",
        claimedAt: null,
        paidAt: null,
        payout: {
          accountName: ACCOUNT.name,
          accountInstitution: ACCOUNT.institution,
          accountMaskedNumber: `dec(${ACCOUNT.maskedNumber})`,
          instructions: null,
          configured: true,
        },
      });
      expect(result).not.toHaveProperty("familyGroupId");
      expect(result).not.toHaveProperty("id");
      expect(result).not.toHaveProperty("participants");
      expect(JSON.stringify(result)).not.toContain(FAMILY_GROUP_ID);
      expect(JSON.stringify(result)).not.toContain(BILL.id);
    });

    // EPIC-023 Group F fix round (HIGH 5) — a deleted payout account must
    // not read to the recipient as "the owner never configured payment
    // details": `configured` stays true (the bill DOES nominate an
    // account) even when that account can no longer be resolved.
    it("reports `configured: true` when the payout account is set but no longer resolvable", async () => {
      prisma.splitParticipant.findUnique.mockResolvedValue({
        ...PARTICIPANT,
        splitBill: BILL,
      });
      prisma.account.findUnique.mockResolvedValue(null);

      const result = await service.getPublicParticipant(PARTICIPANT.shareToken);

      expect(result.payout).toEqual({
        accountName: null,
        accountInstitution: null,
        accountMaskedNumber: null,
        instructions: null,
        configured: true,
      });
    });

    it("reports `configured: false` when the owner never nominated a payout account", async () => {
      prisma.splitParticipant.findUnique.mockResolvedValue({
        ...PARTICIPANT,
        splitBill: { ...BILL, payoutAccountId: null },
      });

      const result = await service.getPublicParticipant(PARTICIPANT.shareToken);

      expect(result.payout.configured).toBe(false);
      expect(prisma.account.findUnique).not.toHaveBeenCalled();
    });

    it("throws NotFoundException for an unknown token", async () => {
      prisma.splitParticipant.findUnique.mockResolvedValue(null);

      await expect(
        service.getPublicParticipant("nonexistent-token"),
      ).rejects.toThrow(NotFoundException);
    });

    it("refuses a revoked bill's link with an honest 410, not a bare 404", async () => {
      prisma.splitParticipant.findUnique.mockResolvedValue({
        ...PARTICIPANT,
        splitBill: { ...BILL, revokedAt: new Date("2026-08-02") },
      });

      await expect(
        service.getPublicParticipant(PARTICIPANT.shareToken),
      ).rejects.toThrow(GoneException);
      expect(prisma.account.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("claimParticipant", () => {
    it("moves pending -> claimed and posts NO money", async () => {
      prisma.splitParticipant.findUnique
        .mockResolvedValueOnce({ ...PARTICIPANT, splitBill: BILL }) // initial lookup
        .mockResolvedValueOnce({
          ...PARTICIPANT,
          status: "claimed",
          claimedAt: new Date("2026-08-03"),
        }); // re-fetch after updateMany
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);

      const result = await service.claimParticipant(PARTICIPANT.shareToken);

      expect(result.status).toBe("claimed");
      expect(prisma.splitParticipant.updateMany).toHaveBeenCalledWith({
        where: { id: PARTICIPANT.id, status: "pending" },
        data: { status: "claimed", claimedAt: expect.any(Date) },
      });
      expect(prisma.transaction.create).not.toHaveBeenCalled();
      expect(prisma.account.update).not.toHaveBeenCalled();
    });

    it("is idempotent when the link is already claimed", async () => {
      const claimed = {
        ...PARTICIPANT,
        status: "claimed",
        claimedAt: new Date("2026-08-03"),
      };
      prisma.splitParticipant.findUnique
        .mockResolvedValueOnce({ ...claimed, splitBill: BILL })
        .mockResolvedValueOnce(claimed);

      const result = await service.claimParticipant(PARTICIPANT.shareToken);

      expect(result.status).toBe("claimed");
      expect(prisma.splitParticipant.updateMany).not.toHaveBeenCalled();
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it("refuses to claim an already-paid participant", async () => {
      prisma.splitParticipant.findUnique.mockResolvedValueOnce({
        ...PARTICIPANT,
        status: "paid",
        splitBill: BILL,
      });

      await expect(
        service.claimParticipant(PARTICIPANT.shareToken),
      ).rejects.toThrow(ConflictException);
      expect(prisma.splitParticipant.updateMany).not.toHaveBeenCalled();
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it("refuses to claim a revoked bill's link", async () => {
      prisma.splitParticipant.findUnique.mockResolvedValueOnce({
        ...PARTICIPANT,
        splitBill: { ...BILL, revokedAt: new Date("2026-08-02") },
      });

      await expect(
        service.claimParticipant(PARTICIPANT.shareToken),
      ).rejects.toThrow(GoneException);
      expect(prisma.splitParticipant.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("confirmParticipant", () => {
    it("posts a real income Transaction, credits the payout account, and marks the participant paid", async () => {
      prisma.splitBill.findUnique.mockResolvedValue(BILL);
      prisma.splitParticipant.findUnique.mockResolvedValue(PARTICIPANT);
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
      prisma.transaction.create.mockResolvedValue({ id: "txn-1" });
      prisma.splitParticipant.update.mockResolvedValue({
        ...PARTICIPANT,
        status: "paid",
        paidAt: new Date("2026-08-05"),
        settlementTransactionId: "txn-1",
      });
      prisma.splitParticipant.count.mockResolvedValue(1); // still one unpaid elsewhere

      const result = await service.confirmParticipant(
        FAMILY_GROUP_ID,
        BILL.id,
        PARTICIPANT.id,
        {},
      );

      expect(result.status).toBe("paid");
      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          familyGroupId: FAMILY_GROUP_ID,
          accountId: ACCOUNT.id,
          amount: PARTICIPANT.amountOwed,
          type: "income",
        }),
      });
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: ACCOUNT.id, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: PARTICIPANT.amountOwed } },
      });
      expect(prisma.splitBill.update).not.toHaveBeenCalled();
    });

    it("assigns the system 'Pending Reimbursement' category instead of null when the family's COA has it seeded", async () => {
      prisma.splitBill.findUnique.mockResolvedValue(BILL);
      prisma.splitParticipant.findUnique.mockResolvedValue(PARTICIPANT);
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
      prisma.coaAccount.findFirst.mockResolvedValue({
        id: "coa-40101",
        familyGroupId: FAMILY_GROUP_ID,
        code: "40101",
      });
      prisma.category.findFirst.mockResolvedValue(null);
      prisma.category.create.mockResolvedValue({
        id: "cat-pending-reimbursement",
        coaAccountId: "coa-40101",
      });
      prisma.transaction.create.mockResolvedValue({ id: "txn-1" });
      prisma.splitParticipant.update.mockResolvedValue({
        ...PARTICIPANT,
        status: "paid",
      });
      prisma.splitParticipant.count.mockResolvedValue(1);

      await service.confirmParticipant(
        FAMILY_GROUP_ID,
        BILL.id,
        PARTICIPANT.id,
        {},
      );

      expect(prisma.coaAccount.findFirst).toHaveBeenCalledWith({
        where: { familyGroupId: FAMILY_GROUP_ID, code: "40101" },
      });
      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          categoryId: "cat-pending-reimbursement",
        }),
      });
    });

    it("reuses an existing 'Pending Reimbursement' category across settlements instead of recreating it", async () => {
      prisma.splitBill.findUnique.mockResolvedValue(BILL);
      prisma.splitParticipant.findUnique.mockResolvedValue(PARTICIPANT);
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
      prisma.coaAccount.findFirst.mockResolvedValue({
        id: "coa-40101",
        familyGroupId: FAMILY_GROUP_ID,
        code: "40101",
      });
      prisma.category.findFirst.mockResolvedValue({
        id: "cat-existing",
        coaAccountId: "coa-40101",
      });
      prisma.transaction.create.mockResolvedValue({ id: "txn-1" });
      prisma.splitParticipant.update.mockResolvedValue({
        ...PARTICIPANT,
        status: "paid",
      });
      prisma.splitParticipant.count.mockResolvedValue(1);

      await service.confirmParticipant(
        FAMILY_GROUP_ID,
        BILL.id,
        PARTICIPANT.id,
        {},
      );

      expect(prisma.category.create).not.toHaveBeenCalled();
      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ categoryId: "cat-existing" }),
      });
    });

    it("falls back to a null category when the family group has no matching COA seeded yet", async () => {
      prisma.splitBill.findUnique.mockResolvedValue(BILL);
      prisma.splitParticipant.findUnique.mockResolvedValue(PARTICIPANT);
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
      prisma.coaAccount.findFirst.mockResolvedValue(null);
      prisma.transaction.create.mockResolvedValue({ id: "txn-1" });
      prisma.splitParticipant.update.mockResolvedValue({
        ...PARTICIPANT,
        status: "paid",
      });
      prisma.splitParticipant.count.mockResolvedValue(1);

      await service.confirmParticipant(
        FAMILY_GROUP_ID,
        BILL.id,
        PARTICIPANT.id,
        {},
      );

      expect(prisma.category.create).not.toHaveBeenCalled();
      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ categoryId: null }),
      });
    });

    it("settles the whole bill once every participant is paid", async () => {
      prisma.splitBill.findUnique.mockResolvedValue(BILL);
      prisma.splitParticipant.findUnique.mockResolvedValue(PARTICIPANT);
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
      prisma.transaction.create.mockResolvedValue({ id: "txn-1" });
      prisma.splitParticipant.update.mockResolvedValue({
        ...PARTICIPANT,
        status: "paid",
      });
      prisma.splitParticipant.count.mockResolvedValue(0); // none unpaid left

      await service.confirmParticipant(
        FAMILY_GROUP_ID,
        BILL.id,
        PARTICIPANT.id,
        {},
      );

      expect(prisma.splitBill.update).toHaveBeenCalledWith({
        where: { id: BILL.id },
        data: { status: "settled" },
      });
    });

    it("confirming twice posts income exactly once (idempotent)", async () => {
      prisma.splitBill.findUnique.mockResolvedValue(BILL);
      // Simulates the SECOND confirm() call: the row is already "paid"
      // from the first call (whether that happened in a prior call or a
      // concurrent transaction that won the Serializable race).
      prisma.splitParticipant.findUnique.mockResolvedValue({
        ...PARTICIPANT,
        status: "paid",
        paidAt: new Date("2026-08-05"),
        settlementTransactionId: "txn-1",
      });

      const result = await service.confirmParticipant(
        FAMILY_GROUP_ID,
        BILL.id,
        PARTICIPANT.id,
        {},
      );

      expect(result.status).toBe("paid");
      expect(prisma.transaction.create).not.toHaveBeenCalled();
      expect(prisma.account.update).not.toHaveBeenCalled();
    });

    it("rejects confirmation when the bill has no payout account set", async () => {
      prisma.splitBill.findUnique.mockResolvedValue({
        ...BILL,
        payoutAccountId: null,
      });
      prisma.splitParticipant.findUnique.mockResolvedValue(PARTICIPANT);

      await expect(
        service.confirmParticipant(
          FAMILY_GROUP_ID,
          BILL.id,
          PARTICIPANT.id,
          {},
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the split bill does not exist in this family group", async () => {
      prisma.splitBill.findUnique.mockResolvedValue(null);

      await expect(
        service.confirmParticipant(
          FAMILY_GROUP_ID,
          "missing-bill",
          PARTICIPANT.id,
          {},
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("revoke", () => {
    it("sets revokedAt so every participant link for this bill dies at once", async () => {
      prisma.splitBill.findUnique.mockResolvedValue(BILL);
      prisma.splitBill.update.mockResolvedValue({
        ...BILL,
        revokedAt: new Date("2026-08-06"),
        participants: [PARTICIPANT],
      });

      const result = await service.revoke(FAMILY_GROUP_ID, BILL.id);

      expect(result.revokedAt).not.toBeNull();
      expect(prisma.splitBill.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BILL.id, familyGroupId: FAMILY_GROUP_ID },
          data: { revokedAt: expect.any(Date) },
        }),
      );
    });

    it("throws NotFoundException for a bill outside this family group", async () => {
      prisma.splitBill.findUnique.mockResolvedValue(null);

      await expect(
        service.revoke(FAMILY_GROUP_ID, "other-bill"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("remove", () => {
    it("refuses to delete a bill with a paid participant whose settlement Transaction still exists", async () => {
      const paidParticipant = {
        ...PARTICIPANT,
        status: "paid",
        settlementTransactionId: "txn-1",
      };
      prisma.splitBill.findUnique.mockResolvedValue({
        ...BILL,
        participants: [paidParticipant],
      });
      // The linked Transaction is still live — the guard must refuse.
      prisma.transaction.findFirst.mockResolvedValue({ id: "txn-1" });

      await expect(service.remove(FAMILY_GROUP_ID, BILL.id)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.transaction.findFirst).toHaveBeenCalledWith({
        where: { id: { in: ["txn-1"] }, familyGroupId: FAMILY_GROUP_ID },
        select: { id: true },
      });
      expect(prisma.splitBill.delete).not.toHaveBeenCalled();
    });

    // MEDIUM 2 (EPIC-023 Group F final fix round) — a settlement Transaction
    // deleted out-of-band (via the normal transactions surface, which knows
    // nothing about split bills) must not leave the bill permanently
    // undeletable. The participant's "paid" status is stale once its own
    // linked Transaction no longer exists.
    it("allows deleting a bill whose paid participant's settlement Transaction was deleted out-of-band", async () => {
      const paidParticipant = {
        ...PARTICIPANT,
        status: "paid",
        settlementTransactionId: "txn-deleted",
      };
      prisma.splitBill.findUnique.mockResolvedValue({
        ...BILL,
        participants: [paidParticipant],
      });
      // The Transaction no longer exists — nothing real left to protect.
      prisma.transaction.findFirst.mockResolvedValue(null);

      await service.remove(FAMILY_GROUP_ID, BILL.id);

      expect(prisma.splitBill.delete).toHaveBeenCalledWith({
        where: { id: BILL.id, familyGroupId: FAMILY_GROUP_ID },
      });
    });

    it("deletes a bill whose participants are only pending/claimed — no money has moved", async () => {
      prisma.splitBill.findUnique.mockResolvedValue({
        ...BILL,
        participants: [
          { ...PARTICIPANT, status: "pending" },
          { ...PARTICIPANT, id: "participant-2", status: "claimed" },
        ],
      });

      await service.remove(FAMILY_GROUP_ID, BILL.id);

      expect(prisma.splitBill.delete).toHaveBeenCalledWith({
        where: { id: BILL.id, familyGroupId: FAMILY_GROUP_ID },
      });
      // No paid participant to check — the settlement lookup is skipped.
      expect(prisma.transaction.findFirst).not.toHaveBeenCalled();
    });

    it("throws NotFoundException for a bill outside this family group", async () => {
      prisma.splitBill.findUnique.mockResolvedValue(null);

      await expect(
        service.remove(FAMILY_GROUP_ID, "other-bill"),
      ).rejects.toThrow(NotFoundException);
    });

    // HIGH 1 (EPIC-023 Group F final fix round) — the paid-participant guard
    // and the delete must commit atomically against a concurrent
    // `confirmParticipant()`, which posts income at Serializable isolation.
    // Deterministic call-shape assertion (not timing-dependent): the guard's
    // read and the delete must be issued through the SAME `$transaction`
    // call, at Serializable isolation — exactly the shape `confirmParticipant`
    // already uses via `runSerializableWithRetry`.
    it("runs the paid-participant guard and the delete inside one Serializable transaction", async () => {
      prisma.splitBill.findUnique.mockResolvedValue({
        ...BILL,
        participants: [{ ...PARTICIPANT, status: "pending" }],
      });

      await service.remove(FAMILY_GROUP_ID, BILL.id);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
      // findUnique and delete both ran against the transactional client
      // handed to the callback (the mock hands back the same `prisma`
      // object), never as a bare read-then-act outside any transaction.
      expect(prisma.splitBill.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.splitBill.delete).toHaveBeenCalledTimes(1);
    });
  });
});
