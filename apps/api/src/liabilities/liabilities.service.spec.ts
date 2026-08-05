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
      findUniqueOrThrow: jest.fn(),
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
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
    },
    coaAccount: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    budget: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
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

  describe("paidThisPeriod", () => {
    it("is true when a payment transaction landed this month", async () => {
      prisma.liability.findMany.mockResolvedValue([
        {
          ...BASE,
          id: "lid-1",
          totalDebt: BigInt(1),
          remainingBalance: BigInt(1),
        },
      ]);
      prisma.transaction.findMany.mockResolvedValue([{ liabilityId: "lid-1" }]);
      const [result] = await service.findAll("fg-1");
      expect(result.paidThisPeriod).toBe(true);
    });

    it("is false when no payment transaction landed this month", async () => {
      prisma.liability.findMany.mockResolvedValue([
        {
          ...BASE,
          id: "lid-1",
          totalDebt: BigInt(1),
          remainingBalance: BigInt(1),
        },
      ]);
      prisma.transaction.findMany.mockResolvedValue([]);
      const [result] = await service.findAll("fg-1");
      expect(result.paidThisPeriod).toBe(false);
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

    // EPIC-023 E2 (D11), redesigned by the group E retry (HIGH 4) — a
    // non-zero minimumPayment auto-creates THIS liability's OWN FIXED
    // budget line (self-healing its own principal Category first, since a
    // brand-new liability never has one yet).
    it("auto-creates a FIXED budget line (and its own principal category) when minimumPayment is set", async () => {
      prisma.liability.create.mockResolvedValue({
        ...BASE,
        id: "lid-new",
        totalDebt: BigInt(10_000_000),
        remainingBalance: BigInt(10_000_000),
        principalCategoryId: null,
      });
      prisma.coaAccount.findFirst.mockResolvedValue({
        id: "coa-5",
        code: "50001",
        name: "Utang",
      });
      prisma.category.create.mockResolvedValue({ id: "cat-principal" });
      prisma.category.findUniqueOrThrow.mockResolvedValue({
        coaAccountId: "coa-5",
      });

      await service.create("fg-1", {
        name: "KTA BNI",
        type: "pinjaman_pribadi" as never,
        totalDebt: "10000000",
        remainingBalance: "10000000",
        minimumPayment: "2083000",
      });

      // HIGH 4 — the category name bakes in the liability's OWN id, so two
      // liabilities can never collide on name even with the same label.
      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {
          familyGroupId: "fg-1",
          name: "Utang — KTA BNI (lid-new)",
          kind: "expense",
          coaAccountId: "coa-5",
        },
      });
      expect(prisma.liability.update).toHaveBeenCalledWith({
        where: { id: "lid-new", familyGroupId: "fg-1" },
        data: { principalCategoryId: "cat-principal" },
      });
      expect(prisma.coaAccount.update).toHaveBeenCalledWith({
        where: { id: "coa-5" },
        data: { budgetType: "FIXED" },
      });
      expect(prisma.budget.upsert).toHaveBeenCalledWith({
        where: {
          familyGroupId_categoryId_period: {
            familyGroupId: "fg-1",
            categoryId: "cat-principal",
            period: "monthly",
          },
        },
        create: {
          familyGroupId: "fg-1",
          categoryId: "cat-principal",
          period: "monthly",
          limitAmount: BigInt(2_083_000),
          liabilityId: "lid-new",
        },
        update: {
          limitAmount: BigInt(2_083_000),
          liabilityId: "lid-new",
        },
      });
    });

    it("does NOT create a budget line when minimumPayment is zero", async () => {
      prisma.liability.create.mockResolvedValue({
        ...BASE,
        id: "lid-new",
        totalDebt: BigInt(10_000_000),
        remainingBalance: BigInt(10_000_000),
      });

      await service.create("fg-1", {
        name: "0% Family Loan",
        type: "pinjaman_pribadi" as never,
        totalDebt: "10000000",
        remainingBalance: "10000000",
      });

      expect(prisma.budget.upsert).not.toHaveBeenCalled();
      expect(prisma.coaAccount.update).not.toHaveBeenCalled();
    });
  });

  // EPIC-023 group E retry (HIGH 4) — `update()` must re-derive this
  // liability's OWN budget line on every change to `minimumPayment`,
  // including the two cases the old `increment`-only design silently
  // dropped: 0 -> non-zero (used to create NOTHING) and non-zero -> 0 (used
  // to leave the line inflated forever).
  describe("update", () => {
    it("throws NotFoundException when the liability does not exist", async () => {
      prisma.liability.findUnique.mockResolvedValue(null);
      await expect(
        service.update("fg-1", "missing-id", { minimumPayment: "100000" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("minimumPayment 0 -> non-zero CREATES a budget line (previously created nothing)", async () => {
      const existing = {
        ...BASE,
        totalDebt: BigInt(10_000_000),
        remainingBalance: BigInt(10_000_000),
        minimumPayment: BigInt(0),
        principalCategoryId: null,
      };
      prisma.liability.findUnique.mockResolvedValue(existing);
      prisma.liability.findUniqueOrThrow.mockResolvedValue(existing);
      prisma.liability.update.mockResolvedValue({
        ...existing,
        minimumPayment: BigInt(2_083_000),
      });
      prisma.coaAccount.findFirst.mockResolvedValue({
        id: "coa-5",
        code: "50001",
        name: "Utang",
      });
      prisma.category.create.mockResolvedValue({ id: "cat-principal" });
      prisma.category.findUniqueOrThrow.mockResolvedValue({
        coaAccountId: "coa-5",
      });

      await service.update("fg-1", "lid-1", { minimumPayment: "2083000" });

      expect(prisma.budget.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            limitAmount: BigInt(2_083_000),
            liabilityId: "lid-1",
          }),
        }),
      );
    });

    it("minimumPayment non-zero -> non-zero RE-DERIVES limitAmount to the new value (never increments)", async () => {
      const existing = {
        ...BASE,
        totalDebt: BigInt(10_000_000),
        remainingBalance: BigInt(10_000_000),
        minimumPayment: BigInt(2_083_000),
        principalCategoryId: "cat-principal",
      };
      prisma.liability.findUnique.mockResolvedValue(existing);
      prisma.liability.findUniqueOrThrow.mockResolvedValue(existing);
      prisma.liability.update.mockResolvedValue({
        ...existing,
        minimumPayment: BigInt(3_000_000),
      });
      prisma.category.findUniqueOrThrow.mockResolvedValue({
        coaAccountId: "coa-5",
      });

      await service.update("fg-1", "lid-1", { minimumPayment: "3000000" });

      expect(prisma.budget.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { limitAmount: BigInt(3_000_000), liabilityId: "lid-1" },
        }),
      );
      // No self-heal category creation — it already had one.
      expect(prisma.category.create).not.toHaveBeenCalled();
    });

    it("minimumPayment non-zero -> 0 REMOVES this liability's budget line (previously left it inflated forever)", async () => {
      const existing = {
        ...BASE,
        totalDebt: BigInt(10_000_000),
        remainingBalance: BigInt(10_000_000),
        minimumPayment: BigInt(2_083_000),
        principalCategoryId: "cat-principal",
      };
      prisma.liability.findUnique.mockResolvedValue(existing);
      prisma.liability.findUniqueOrThrow.mockResolvedValue(existing);
      prisma.liability.update.mockResolvedValue({
        ...existing,
        minimumPayment: BigInt(0),
      });

      await service.update("fg-1", "lid-1", { minimumPayment: "0" });

      expect(prisma.budget.deleteMany).toHaveBeenCalledWith({
        where: { familyGroupId: "fg-1", liabilityId: "lid-1" },
      });
      expect(prisma.budget.upsert).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("throws NotFoundException when liability does not exist", async () => {
      prisma.liability.findUnique.mockResolvedValue(null);
      await expect(service.remove("fg-1", "missing-id")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("deletes when there is no budget line for this liability", async () => {
      prisma.liability.findUnique.mockResolvedValue(BASE);
      prisma.budget.deleteMany.mockResolvedValue({ count: 0 });

      await service.remove("fg-1", "lid-1");

      expect(prisma.liability.delete).toHaveBeenCalledWith({
        where: { id: "lid-1", familyGroupId: "fg-1" },
      });
    });

    // EPIC-023 group E retry (HIGH 4) — a liability's budget line is now
    // EXCLUSIVE to it (its own Category, never shared), so deleting the
    // liability auto-removes ITS OWN line instead of the old 409 that
    // blocked deletion until the user found and deleted a budget line
    // shared with every OTHER liability in the family.
    it("auto-removes this liability's OWN budget line, scoped by liabilityId, before deleting it — never a 409", async () => {
      prisma.liability.findUnique.mockResolvedValue(BASE);
      prisma.budget.deleteMany.mockResolvedValue({ count: 1 });

      await service.remove("fg-1", "lid-1");

      expect(prisma.budget.deleteMany).toHaveBeenCalledWith({
        where: { familyGroupId: "fg-1", liabilityId: "lid-1" },
      });
      expect(prisma.liability.delete).toHaveBeenCalledWith({
        where: { id: "lid-1", familyGroupId: "fg-1" },
      });
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
      // HIGH 4 — this liability already has its own principal category
      // (resolveOwnPrincipalCategoryId returns it directly, no self-heal
      // needed); see the dedicated self-heal test below for the null case.
      principalCategoryId: "cat-principal",
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
      // HIGH 4 — LIABILITY already carries its own principalCategoryId, so
      // resolveOwnPrincipalCategoryId returns it directly (no category
      // lookup at all for the principal leg). Only the (still-shared)
      // interest category is looked up.
      prisma.category.findFirst.mockResolvedValueOnce({ id: "cat-interest" });
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

    // EPIC-023 E1 — the principal leg links liabilityId and is posted as a
    // TRANSFER (money moving from cash into paying down debt, not a real
    // expense — the deferred half of A3's fix, see liabilities.service.ts's
    // runPayment doc comment). The interest leg stays an ordinary EXPENSE
    // and does NOT carry liabilityId — it is real money spent, not a debt
    // paydown. Golden values: same month-1 split as the test above (12% on
    // 100,000,000 -> interest 1,000,000, principal 4,000,000).
    it("links the principal leg to the liability as a transfer; the interest leg stays an unlinked expense (EPIC-023 E1)", async () => {
      prisma.liability.findUnique.mockResolvedValue(LIABILITY);
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
      prisma.category.findFirst.mockResolvedValueOnce({ id: "cat-interest" });
      prisma.liability.update.mockResolvedValue({
        ...LIABILITY,
        remainingBalance: BigInt(96_000_000),
      });

      await service.pay("fg-1", "lid-1", {
        sourceAccountId: "acc-1",
        amount: "5000000",
      });

      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            categoryId: "cat-principal",
            amount: BigInt(4_000_000),
            type: "transfer",
            liabilityId: "lid-1",
          }),
        }),
      );
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            categoryId: "cat-interest",
            amount: BigInt(1_000_000),
            type: "expense",
          }),
        }),
      );
      const interestCall = prisma.transaction.create.mock.calls.find(
        (call) => call[0].data.categoryId === "cat-interest",
      );
      expect(interestCall?.[0].data.liabilityId).toBeUndefined();
    });

    it("skips the interest transaction entirely when interest is 0 (a 0% liability)", async () => {
      prisma.liability.findUnique.mockResolvedValue({
        ...LIABILITY,
        interestRate: { toString: () => "0" },
        remainingBalance: BigInt(10_000_000),
      });
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
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

    it("self-heals by creating its OWN group-5 TRANSFER category when it has none yet (principalCategoryId: null)", async () => {
      prisma.liability.findUnique.mockResolvedValue({
        ...LIABILITY,
        principalCategoryId: null,
      });
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
      prisma.category.findFirst.mockResolvedValueOnce(null); // interest: none exists yet either
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

      // HIGH 4 — the principal category name bakes in the liability's own
      // id ("lid-1"), unlike the still-shared interest category.
      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {
          familyGroupId: "fg-1",
          name: "Utang — KTA BNI (lid-1)",
          kind: "expense",
          coaAccountId: "coa-5",
        },
      });
      expect(prisma.liability.update).toHaveBeenCalledWith({
        where: { id: "lid-1", familyGroupId: "fg-1" },
        data: { principalCategoryId: "cat-new-principal" },
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
      prisma.category.findFirst.mockResolvedValue({ id: "cat-interest" });
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
    // HIGH 4 note — the SHARED-category race this test used to exercise
    // (two DIFFERENT liabilities racing to self-heal the SAME family-wide
    // category) is now structurally impossible: the category name bakes in
    // this liability's OWN id (`ownCategoryName`). The race that remains is
    // two CONCURRENT payments against the SAME liability, both reading
    // `principalCategoryId: null` before either has committed its self-heal
    // — exercised here.
    it("retries the whole transaction on a concurrent OWN-category self-heal race (P2002) for the SAME liability, succeeding once the retry sees the winner's committed category", async () => {
      prisma.liability.findUnique
        .mockResolvedValueOnce({ ...LIABILITY, principalCategoryId: null }) // attempt 1: no own category yet
        .mockResolvedValueOnce({
          ...LIABILITY,
          principalCategoryId: "cat-principal",
        }); // attempt 2: the winning concurrent call already committed it
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
      prisma.category.findFirst.mockResolvedValueOnce({ id: "cat-interest" }); // attempt 2's interest lookup only
      prisma.coaAccount.findFirst.mockResolvedValueOnce({
        id: "coa-5",
        code: "50001",
        name: "Utang",
        groupNum: 5,
        direction: "TRANSFER",
      });
      // Attempt 1's category.create loses the race with P2002, aborting and
      // rolling back the whole transaction — never reached a second time
      // because attempt 2's principalCategoryId is already set.
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

  // EPIC-023 Task E3 (D12, US-LIAB-5) — "a credit card stays a liability;
  // spending raises the card's debt and leaves the bank untouched."
  describe("purchase", () => {
    const CARD = {
      ...BASE,
      id: "card-1",
      type: "kartu_kredit",
      totalDebt: BigInt(5_000_000),
      remainingBalance: BigInt(2_000_000),
    };

    it("rejects a zero or non-numeric amount before touching any table", async () => {
      await expect(
        service.purchase("fg-1", "card-1", { amount: "0" }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.purchase("fg-1", "card-1", { amount: "abc" }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.liability.findUnique).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the liability does not exist in this family group", async () => {
      prisma.liability.findUnique.mockResolvedValue(null);
      await expect(
        service.purchase("fg-1", "missing-id", { amount: "100000" }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.liability.update).not.toHaveBeenCalled();
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it("rejects a categoryId from another family group (tenant scoping)", async () => {
      prisma.liability.findUnique.mockResolvedValue(CARD);
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.purchase("fg-1", "card-1", {
          amount: "100000",
          categoryId: "cat-other-family",
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.liability.update).not.toHaveBeenCalled();
    });

    it("raises remainingBalance AND totalDebt atomically via increment, creates exactly one linked Transaction, and NEVER touches an Account", async () => {
      prisma.liability.findUnique.mockResolvedValue(CARD);
      prisma.category.findUnique.mockResolvedValue({ id: "cat-1" });
      prisma.liability.update.mockResolvedValue({
        ...CARD,
        remainingBalance: BigInt(2_150_000),
        totalDebt: BigInt(5_150_000),
      });

      const result = await service.purchase("fg-1", "card-1", {
        amount: "150000",
        categoryId: "cat-1",
        description: "Belanja bulanan",
      });

      // Atomic `{ increment }` — NOT a read-then-write of the fetched
      // `CARD.remainingBalance` — mirrors pay()'s lost-update fix.
      expect(prisma.liability.update).toHaveBeenCalledWith({
        where: { id: "card-1", familyGroupId: "fg-1" },
        data: {
          remainingBalance: { increment: BigInt(150_000) },
          totalDebt: { increment: BigInt(150_000) },
        },
      });

      expect(prisma.transaction.create).toHaveBeenCalledTimes(1);
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            familyGroupId: "fg-1",
            accountId: null,
            liabilityId: "card-1",
            categoryId: "cat-1",
            amount: BigInt(150_000),
            type: "expense",
            description: "Belanja bulanan",
          }),
        }),
      );

      // The negative the acceptance criterion is built on: no account
      // lookup, no account balance mutation, ever.
      expect(prisma.account.findUnique).not.toHaveBeenCalled();
      expect(prisma.account.update).not.toHaveBeenCalled();

      expect(result.remainingBalance).toBe("2150000");
    });

    it("defaults occurredAt to now and categoryId/description to null when omitted", async () => {
      prisma.liability.findUnique.mockResolvedValue(CARD);
      prisma.liability.update.mockResolvedValue(CARD);

      await service.purchase("fg-1", "card-1", { amount: "50000" });

      expect(prisma.category.findUnique).not.toHaveBeenCalled();
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            categoryId: null,
            description: null,
            accountId: null,
          }),
        }),
      );
    });
  });
});
