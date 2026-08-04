import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

import { LiabilitiesService } from "./liabilities.service";

import type { TestingModule } from "@nestjs/testing";

/** Mirrors categories.service.spec.ts's helper for constructing Prisma errors. */
function serializationFailure() {
  return new Prisma.PrismaClientKnownRequestError(
    "Transaction failed due to a write conflict or a deadlock. Please retry your transaction",
    { code: "P2034", clientVersion: "test" },
  );
}

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

/**
 * `$transaction` invokes its callback with the SAME mocked client (real
 * Prisma hands back a distinct `tx`, but nothing here depends on that
 * distinction) so assertions can inspect calls made inside `pay()`'s
 * transaction via the same jest.fn()s — mirrors goals.service.spec.ts.
 */
function makePrisma() {
  const prisma = {
    liability: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    account: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    category: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    coaAccount: {
      findFirst: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma),
  );
  return prisma;
}

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

  // EPIC-023 A2 — `pay()` splits a payment into principal/interest
  // (amortisation.util) inside one `$transaction`: debits the source
  // account, reduces `remainingBalance` by the principal only, and posts
  // both legs against the group-5 TRANSFER and loan-interest EXPENSE
  // categories.
  describe("pay", () => {
    const LIABILITY = {
      ...BASE,
      totalDebt: BigInt(100_000_000),
      remainingBalance: BigInt(100_000_000),
      interestRate: { toString: () => "12.00" },
    };
    // EPIC-023 review follow-up — a real `bank`-type account with enough
    // balance to cover every happy-path payment below. `balance: BigInt(0)`
    // here previously encoded the bug this fixture exists to prevent: `pay()`
    // bypassed the EPIC-021 #22 bank-overdraft floor entirely, so a
    // zero-balance bank account could be driven negative by a payment. See
    // the dedicated "bank-overdraft floor" tests further down for the
    // rejection path.
    const ACCOUNT = {
      id: "acc-1",
      familyGroupId: "fg-1",
      type: "bank",
      balance: BigInt(50_000_000),
      name: "BCA",
    };

    it("throws NotFoundException when the liability does not exist in this family group", async () => {
      prisma.liability.findUnique.mockResolvedValue(null);
      await expect(
        service.pay("fg-1", "missing-id", {
          sourceAccountId: "acc-1",
          amount: "1000000",
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.account.update).not.toHaveBeenCalled();
    });

    it("rejects a source account from another family group (tenant scoping)", async () => {
      prisma.liability.findUnique.mockResolvedValue(LIABILITY);
      // `findUnique({ where: { id, familyGroupId } })` returns null for an
      // account that belongs to a different family group — the same
      // composite-key scoping used everywhere else in this codebase.
      prisma.account.findUnique.mockResolvedValue(null);

      await expect(
        service.pay("fg-1", "lid-1", {
          sourceAccountId: "acc-other-family",
          amount: "1000000",
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.account.update).not.toHaveBeenCalled();
      expect(prisma.liability.update).not.toHaveBeenCalled();
    });

    it("rejects a payment that exceeds remainingBalance + interest due", async () => {
      prisma.liability.findUnique.mockResolvedValue({
        ...LIABILITY,
        remainingBalance: BigInt(1_000_000),
      });
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);

      // 12% annual on 1,000,000 remaining -> 10,000 interest due, so the
      // most payable this month is 1,010,000 — 2,000,000 must be rejected.
      await expect(
        service.pay("fg-1", "lid-1", {
          sourceAccountId: "acc-1",
          amount: "2000000",
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.account.update).not.toHaveBeenCalled();
      expect(prisma.liability.update).not.toHaveBeenCalled();
    });

    it("rejects a zero or non-numeric amount before touching any table", async () => {
      await expect(
        service.pay("fg-1", "lid-1", { sourceAccountId: "acc-1", amount: "0" }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.pay("fg-1", "lid-1", {
          sourceAccountId: "acc-1",
          amount: "abc",
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.liability.findUnique).not.toHaveBeenCalled();
    });

    it("splits a payment into principal/interest, debits the source account by the full payment, and posts both legs", async () => {
      prisma.liability.findUnique.mockResolvedValue(LIABILITY);
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
      prisma.category.findFirst
        .mockResolvedValueOnce({ id: "cat-principal" }) // group-5 TRANSFER category already exists
        .mockResolvedValueOnce({ id: "cat-interest" }); // loan-interest EXPENSE category already exists
      prisma.liability.update.mockResolvedValue({
        ...LIABILITY,
        remainingBalance: BigInt(96_000_000),
      });

      // Month 1 of the golden schedule (amortisation.util.spec.ts): 12% on
      // 100,000,000 -> interest 1,000,000, principal 4,000,000.
      const result = await service.pay("fg-1", "lid-1", {
        sourceAccountId: "acc-1",
        amount: "5000000",
      });

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: "acc-1", familyGroupId: "fg-1" },
        data: { balance: { decrement: BigInt(5_000_000) } },
      });
      // EPIC-023 review follow-up (CRITICAL lost-update fix) — this used to
      // assert the literal computed value `{ remainingBalance: BigInt(96_000_000) }`,
      // which pinned the read-then-write race: two concurrent payments each
      // read the same starting balance and would both write the same
      // literal, silently dropping one payment's principal. An atomic
      // `decrement` is race-safe regardless of how many concurrent writers
      // there are — each decrement is applied against the CURRENT row value,
      // not a value read earlier in the request.
      expect(prisma.liability.update).toHaveBeenCalledWith({
        where: { id: "lid-1", familyGroupId: "fg-1" },
        data: { remainingBalance: { decrement: BigInt(4_000_000) } },
      });
      expect(prisma.transaction.create).toHaveBeenCalledTimes(2);
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            categoryId: "cat-principal",
            amount: BigInt(4_000_000),
          }),
        }),
      );
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            categoryId: "cat-interest",
            amount: BigInt(1_000_000),
          }),
        }),
      );
      expect(result.remainingBalance).toBe("96000000");
    });

    it("skips the interest transaction entirely when interest is 0 (a 0% liability)", async () => {
      prisma.liability.findUnique.mockResolvedValue({
        ...LIABILITY,
        interestRate: { toString: () => "0" },
        remainingBalance: BigInt(10_000_000),
      });
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
      prisma.category.findFirst.mockResolvedValue({ id: "cat-principal" });
      prisma.liability.update.mockResolvedValue({
        ...LIABILITY,
        remainingBalance: BigInt(9_000_000),
      });

      await service.pay("fg-1", "lid-1", {
        sourceAccountId: "acc-1",
        amount: "1000000",
      });

      expect(prisma.transaction.create).toHaveBeenCalledTimes(1);
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ categoryId: "cat-principal" }),
        }),
      );
    });

    it("self-heals by creating the group-5 TRANSFER category when none exists yet", async () => {
      prisma.liability.findUnique.mockResolvedValue(LIABILITY);
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
      prisma.category.findFirst.mockResolvedValue(null);
      prisma.coaAccount.findFirst
        .mockResolvedValueOnce({
          id: "coa-5",
          code: "50001",
          name: "Utang",
          groupNum: 5,
          direction: "TRANSFER",
        })
        .mockResolvedValueOnce({
          id: "coa-interest",
          code: "20009",
          name: "Bunga Pinjaman",
        });
      prisma.category.create
        .mockResolvedValueOnce({ id: "cat-new-principal" })
        .mockResolvedValueOnce({ id: "cat-new-interest" });
      prisma.liability.update.mockResolvedValue({
        ...LIABILITY,
        remainingBalance: BigInt(96_000_000),
      });

      await service.pay("fg-1", "lid-1", {
        sourceAccountId: "acc-1",
        amount: "5000000",
      });

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {
          familyGroupId: "fg-1",
          name: "Utang",
          kind: "expense",
          coaAccountId: "coa-5",
        },
      });
      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {
          familyGroupId: "fg-1",
          name: "Bunga Pinjaman",
          kind: "expense",
          coaAccountId: "coa-interest",
        },
      });
    });

    // HIGH — EPIC-021 #22's bank-overdraft floor previously did not apply to
    // pay()'s source-account debit at all.
    it("rejects a payment from a bank account whose balance would go below zero (EPIC-021 #22)", async () => {
      prisma.liability.findUnique.mockResolvedValue(LIABILITY);
      prisma.account.findUnique.mockResolvedValue({
        ...ACCOUNT,
        balance: BigInt(1_000_000),
      });

      await expect(
        service.pay("fg-1", "lid-1", {
          sourceAccountId: "acc-1",
          amount: "5000000",
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.account.update).not.toHaveBeenCalled();
      expect(prisma.liability.update).not.toHaveBeenCalled();
    });

    // CRITICAL — lost-update race on Liability.remainingBalance. Serializable
    // isolation + a bounded retry (mirrors CategoriesService.remove()'s
    // isolation choice) must transparently recover from a P2034 by re-running
    // the payment against the now-current balance.
    it("retries once on a P2034 serialization failure and succeeds on the second attempt", async () => {
      prisma.liability.findUnique.mockResolvedValue(LIABILITY);
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
      prisma.category.findFirst
        .mockResolvedValueOnce({ id: "cat-principal" })
        .mockResolvedValueOnce({ id: "cat-interest" });
      prisma.liability.update.mockResolvedValue({
        ...LIABILITY,
        remainingBalance: BigInt(96_000_000),
      });
      // The first attempt loses the concurrent Serializable conflict; the
      // retry loop must re-enter $transaction rather than surfacing P2034.
      prisma.$transaction.mockImplementationOnce(() =>
        Promise.reject(serializationFailure()),
      );

      const result = await service.pay("fg-1", "lid-1", {
        sourceAccountId: "acc-1",
        amount: "5000000",
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(result.remainingBalance).toBe("96000000");
    });

    it("gives up and surfaces the P2034 once every retry attempt loses the conflict", async () => {
      prisma.liability.findUnique.mockResolvedValue(LIABILITY);
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
      prisma.$transaction.mockImplementation(() =>
        Promise.reject(serializationFailure()),
      );

      await expect(
        service.pay("fg-1", "lid-1", {
          sourceAccountId: "acc-1",
          amount: "5000000",
        }),
      ).rejects.toThrow(Prisma.PrismaClientKnownRequestError);
      // Bounded: exactly 3 attempts, not an infinite/unbounded retry loop.
      expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    });

    // HIGH — EPIC-023 review follow-up (retry #3). The PREVIOUS version of
    // this test asserted an in-transaction re-read after catching P2002 —
    // that recovery is provably impossible against real Postgres: any
    // statement error aborts the whole transaction (SQLSTATE 25P02,
    // "current transaction is aborted"), and Prisma's interactive
    // `$transaction` does not wrap queries in implicit SAVEPOINTs, so a
    // follow-up `findFirst` on the SAME `tx` is guaranteed to fail. This
    // replacement asserts the real mechanism instead: the P2002 aborts and
    // rolls back the WHOLE `$transaction` (attempt 1), `pay()`'s bounded
    // retry loop treats P2002 as retryable exactly like P2034, and the
    // SECOND, fresh `$transaction` attempt's self-heal `findFirst` now sees
    // the winner's already-committed category.
    it("retries the whole transaction on a concurrent category self-heal race (P2002), succeeding once the retry sees the winner's category", async () => {
      prisma.liability.findUnique.mockResolvedValue(LIABILITY);
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
      prisma.category.findFirst
        .mockResolvedValueOnce(null) // attempt 1, principal: no existing category yet
        .mockResolvedValueOnce({ id: "cat-principal" }) // attempt 2, principal: winner's row now exists
        .mockResolvedValueOnce({ id: "cat-interest" }); // attempt 2, interest: already exists
      prisma.coaAccount.findFirst.mockResolvedValueOnce({
        id: "coa-5",
        code: "50001",
        name: "Utang",
        groupNum: 5,
        direction: "TRANSFER",
      });
      // Attempt 1's category.create loses the race with P2002, aborting and
      // rolling back the whole transaction — never reached a second time
      // because attempt 2's self-heal findFirst finds the category already.
      prisma.category.create.mockRejectedValueOnce(uniqueViolation());
      prisma.liability.update.mockResolvedValue({
        ...LIABILITY,
        remainingBalance: BigInt(96_000_000),
      });

      const result = await service.pay("fg-1", "lid-1", {
        sourceAccountId: "acc-1",
        amount: "5000000",
      });

      // The whole $transaction was retried (attempt 1 aborted by P2002,
      // attempt 2 succeeded) — matching the style of the P2034 retry test.
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(prisma.category.create).toHaveBeenCalledTimes(1);
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ categoryId: "cat-principal" }),
        }),
      );
      expect(result.remainingBalance).toBe("96000000");
    });
  });
});
