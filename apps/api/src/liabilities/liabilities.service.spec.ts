import { BadRequestException, Logger, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Prisma } from "@prisma/client";

import { NOTIFICATION_SENDER_PORT } from "../notifications/notification-sender.port";
import { PrismaService } from "../prisma/prisma.service";
// H5 (group E retry round 4) — mocked at the module boundary so `pay()`'s
// (fire-and-forget) call to `checkBudgetAlert` can be asserted directly,
// without re-exercising its own internal logic (already covered by the
// dedicated `transaction-alerts.util.spec.ts`) and without the timing
// fragility of awaiting a `void`-called async function.
import * as transactionAlerts from "../transactions/transaction-alerts.util";

import { LiabilitiesService } from "./liabilities.service";

import type { TestingModule } from "@nestjs/testing";

jest.mock("../transactions/transaction-alerts.util", () => ({
  checkBudgetAlert: jest.fn(),
  checkCashFlowAlert: jest.fn(),
  notifyTransaction: jest.fn(),
}));

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
    // L9 (group E retry round 4) — `purchase()`'s `getMemberThreshold`
    // looks this up; `undefined` by default (no test sets a return value)
    // means "no threshold set" unless a test overrides it.
    member: {
      findUnique: jest.fn(),
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
      // C1 (group E retry round 4) — `remove()` looks this up to decide
      // whether to refuse deletion; `null` by default means "no budget
      // line, delete freely" unless a test overrides it.
      findFirst: jest.fn().mockResolvedValue(null),
      deleteMany: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      // C3 (group E retry round 4) — `assertNotAlreadyPaidThisPeriod`
      // (called inside `pay()`'s transaction) looks this up; `null` by
      // default means "no existing payment this period" unless a test
      // overrides it.
      //
      // HIGH 10 (group E retry round 3b) —
      // `warnIfPriorSharedBudgetLine` ALSO calls `findFirst`, looking for
      // this liability's PRIOR principal-payment transaction; `null` by
      // default means "brand new liability, nothing to warn about" unless
      // a test overrides it.
      findFirst: jest.fn().mockResolvedValue(null),
    },
    // HIGH 10 (group E retry round 3b) — `warnIfPriorSharedBudgetLine`
    // persists a Notification when it detects a stale shared budget line.
    notification: {
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
  interestMethod: "efektif",
  tenorMonths: null,
  startDate: null,
  installmentAmount: null,
  fixedRateMonths: null,
  floatingRate: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

describe("LiabilitiesService", () => {
  let service: LiabilitiesService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiabilitiesService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NOTIFICATION_SENDER_PORT,
          useValue: { send: jest.fn(), sendEmail: jest.fn() },
        },
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

  describe("interest terms in the response (revisi G)", () => {
    it("maps interestMethod, tenor, start date, installment and KPR floating terms to wire values", async () => {
      prisma.liability.findMany.mockResolvedValue([
        {
          ...BASE,
          type: "kpr",
          totalDebt: BigInt(500_000_000),
          remainingBalance: BigInt(500_000_000),
          interestMethod: "anuitas",
          tenorMonths: 240,
          startDate: new Date("2026-01-15T00:00:00.000Z"),
          installmentAmount: BigInt(4_182_200),
          fixedRateMonths: 36,
          floatingRate: { toString: () => "11" },
        },
      ]);

      const [dto] = await service.findAll("fg-1");

      expect(dto).toEqual(
        expect.objectContaining({
          interestMethod: "anuitas",
          tenorMonths: 240,
          startDate: "2026-01-15T00:00:00.000Z",
          installmentAmount: "4182200",
          fixedRateMonths: 36,
          floatingRate: "11",
        }),
      );
    });

    it("maps a legacy efektif row with no terms to nulls", async () => {
      prisma.liability.findMany.mockResolvedValue([
        {
          ...BASE,
          totalDebt: BigInt(10_000_000),
          remainingBalance: BigInt(5_000_000),
        },
      ]);

      const [dto] = await service.findAll("fg-1");

      expect(dto).toEqual(
        expect.objectContaining({
          interestMethod: "efektif",
          tenorMonths: null,
          startDate: null,
          installmentAmount: null,
          fixedRateMonths: null,
          floatingRate: null,
        }),
      );
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

    // C1 (group E retry round 4) — the `/anggaran` "Sudah Dibayar" badge
    // must never be driven by a card PURCHASE (accountId: null); only a real
    // payment leg (accountId set) counts.
    it("queries with the accountId payment-leg filter, so a purchase never counts as 'paid this period'", async () => {
      prisma.liability.findMany.mockResolvedValue([
        {
          ...BASE,
          id: "lid-1",
          totalDebt: BigInt(1),
          remainingBalance: BigInt(1),
        },
      ]);
      prisma.transaction.findMany.mockResolvedValue([]);

      await service.findAll("fg-1");

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ accountId: { not: null } }),
        }),
      );
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
          name: "Utang: KTA BNI",
          kind: "expense",
          coaAccountId: "coa-5",
        },
      });
      expect(prisma.liability.update).toHaveBeenCalledWith({
        where: { id: "lid-new", familyGroupId: "fg-1" },
        data: { principalCategoryId: "cat-principal" },
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
          budgetType: "FIXED",
        },
        update: {
          limitAmount: BigInt(2_083_000),
          liabilityId: "lid-new",
          budgetType: "FIXED",
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
          update: {
            limitAmount: BigInt(3_000_000),
            liabilityId: "lid-1",
            budgetType: "FIXED",
          },
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

    // HIGH 9 (group E retry round 3b) — a PATCH that only changes `notes`
    // must never revert a concurrent `pay()`'s balance change. The outer
    // `findUnique` (before the Serializable retry loop) is STALE by the
    // time the transaction actually reads: someone else paid in between,
    // dropping `remainingBalance`. `runUpdate` must fall back to the FRESH
    // `findUniqueOrThrow` read taken inside the (possibly retried)
    // transaction, never to the stale outer read, when the caller did not
    // explicitly supply that field.
    it("keeps a concurrent payment's balance drop when a PATCH only changes notes (never reverts to the stale outer read)", async () => {
      const staleOuterRead = {
        ...BASE,
        totalDebt: BigInt(10_000_000),
        remainingBalance: BigInt(10_000_000), // stale: read before the payment
        minimumPayment: BigInt(2_083_000),
        principalCategoryId: "cat-principal",
      };
      const freshInsideTx = {
        ...staleOuterRead,
        remainingBalance: BigInt(7_000_000), // a concurrent pay() already landed
      };
      prisma.liability.findUnique.mockResolvedValue(staleOuterRead);
      prisma.liability.findUniqueOrThrow.mockResolvedValue(freshInsideTx);
      prisma.liability.update.mockResolvedValue({
        ...freshInsideTx,
        notes: "updated notes",
      });

      await service.update("fg-1", "lid-1", { notes: "updated notes" });

      expect(prisma.liability.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            // Must be the FRESH balance (7,000,000), never the stale outer
            // read (10,000,000) — the whole point of this fix.
            remainingBalance: BigInt(7_000_000),
            totalDebt: BigInt(10_000_000),
            minimumPayment: BigInt(2_083_000),
            notes: "updated notes",
          }),
        }),
      );
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
      prisma.budget.findFirst.mockResolvedValue(null);

      await service.remove("fg-1", "lid-1");

      expect(prisma.liability.delete).toHaveBeenCalledWith({
        where: { id: "lid-1", familyGroupId: "fg-1" },
      });
    });

    // EPIC-023 group E retry round 4 (C1) — D11 verbatim: "Deleting a
    // liability is refused while its budget line exists — never a silent
    // cascade." A prior version of this method silently `deleteMany`'d the
    // liability's budget line before deleting the liability — exactly the
    // cascade D11 forbids. Per-obligation budget rows (HIGH 4's own
    // Category per liability) make the refusal check EXACT: a liability
    // that never had a line (minimumPayment stayed 0) is still freely
    // deletable (covered above); one that DOES have a line refuses with a
    // `ConflictException` naming the liability and its budget line, and
    // neither `budget.deleteMany` nor `liability.delete` is ever called.
    it("refuses deletion with a ConflictException naming the liability and its budget line when one exists — never a silent cascade", async () => {
      prisma.liability.findUnique.mockResolvedValue(BASE);
      prisma.budget.findFirst.mockResolvedValue({ id: "budget-1" });

      await expect(service.remove("fg-1", "lid-1")).rejects.toMatchObject({
        status: 409,
        message: expect.stringContaining(BASE.name),
      });
      await expect(service.remove("fg-1", "lid-1")).rejects.toMatchObject({
        message: expect.stringContaining("budget-1"),
      });
      expect(prisma.budget.deleteMany).not.toHaveBeenCalled();
      expect(prisma.liability.delete).not.toHaveBeenCalled();
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

    // C3 (group E retry round 4) — server-side idempotency: a second payment
    // for the SAME liability within the current period must be rejected,
    // not merely disabled client-side. This is the ONLY thing that stops a
    // double debit from a second tab, a stale page, a replayed request, or
    // a direct API call.
    it("rejects a second payment for the same liability within the current period", async () => {
      prisma.liability.findUnique.mockResolvedValue(LIABILITY);
      prisma.transaction.findFirst.mockResolvedValue({ id: "tx-existing" });

      await expect(
        service.pay("fg-1", "lid-1", {
          sourceAccountId: "acc-1",
          amount: "1000000",
        }),
      ).rejects.toMatchObject({ status: 409 });
      expect(prisma.account.findUnique).not.toHaveBeenCalled();
      expect(prisma.account.update).not.toHaveBeenCalled();
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

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

    // C1 (group E retry round 4) — a card PURCHASE (`purchase()`) also
    // stamps `liabilityId` with `type: "expense"`, the SAME type as a real
    // payment's interest leg — so `type` alone cannot tell them apart. The
    // guard must filter on `accountId: { not: null }` instead (a purchase
    // never sets one; every payment leg always does).
    it("filters the already-paid guard to payment legs only (accountId set) — never a purchase leg", async () => {
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

      expect(prisma.transaction.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ accountId: { not: null } }),
        }),
      );
    });

    // C1 (group E retry round 4) — the runtime-proved regression: buying
    // groceries on a card (a purchase, `accountId: null`) must never make
    // that SAME card's bill unpayable this period. A fake `transaction
    // .findFirst` that actually HONORS the `accountId: { not: null }` filter
    // (unlike the plain `mockResolvedValue(null)` stub used elsewhere) is
    // what makes this test fail without the fix: without it, the guard's
    // query carries no `accountId` filter at all, so this mock's `else`
    // branch matches and wrongly returns the purchase row as if it were a
    // payment, and `pay()` throws a 409 instead of succeeding.
    it("lets a payment through even when a card purchase already landed this period", async () => {
      prisma.liability.findUnique.mockResolvedValue(LIABILITY);
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
      prisma.category.findFirst.mockResolvedValueOnce({ id: "cat-interest" });
      prisma.liability.update.mockResolvedValue({
        ...LIABILITY,
        remainingBalance: BigInt(96_000_000),
      });
      prisma.transaction.findFirst.mockImplementation(
        ({ where }: { where: { accountId?: { not: null } } }) => {
          // A real purchase (accountId: null) is excluded by this filter;
          // without it, every call falls into the `else` and wrongly
          // resolves to an existing "payment".
          if (where.accountId && where.accountId.not === null) {
            return Promise.resolve(null);
          }
          return Promise.resolve({ id: "tx-purchase-this-period" });
        },
      );

      const result = await service.pay("fg-1", "lid-1", {
        sourceAccountId: "acc-1",
        amount: "5000000",
      });

      expect(result.remainingBalance).toBe("96000000");
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

    // H5 (group E retry round 4) — `purchase()` already fired
    // `checkBudgetAlert` for every card charge; `pay()` never did, so a
    // FIXED principal line paid well past its `limitAmount` showed as
    // over-budget on `/anggaran` while no 80%/100% notification ever fired
    // for it. Fired once, with THIS liability's own principal categoryId,
    // AFTER the payment has committed.
    it("fires checkBudgetAlert for the liability's own principal category after a successful payment", async () => {
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

      expect(transactionAlerts.checkBudgetAlert).toHaveBeenCalledWith(
        prisma,
        expect.anything(),
        "fg-1",
        "cat-principal",
      );
    });

    // EPIC-023 E1 — the principal leg links liabilityId and is posted as a
    // TRANSFER (money moving from cash into paying down debt, not a real
    // expense — the deferred half of A3's fix, see liabilities.service.ts's
    // runPayment doc comment). The interest leg stays an ordinary EXPENSE
    // and does NOT carry liabilityId — it is real money spent, not a debt
    // paydown. Golden values: same month-1 split as the test above (12% on
    // 100,000,000 -> interest 1,000,000, principal 4,000,000).
    // C2 bullet 1 (group E retry round 4) — the interest leg used to carry
    // NO `liabilityId`: an interest-only payment (principal === 0, e.g. a
    // payment that only covers accrued interest) posted ONLY this row, so
    // `paidThisPeriod` never flipped true for a REAL payment, letting the
    // same period be "paid" an unbounded number of times. BOTH legs now
    // link `liabilityId` — the interest leg stays an ordinary EXPENSE
    // (still excluded from the liability's own TRANSFER-only budget line,
    // C5), but IS counted by the double-payment guard.
    it("links BOTH the principal (transfer) and interest (expense) legs to the liability (EPIC-023 E1 / C2)", async () => {
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
            liabilityId: "lid-1",
          }),
        }),
      );
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

      // HIGH 6 (group E retry round 3b) — this is the assertion the whole
      // finding is about: `reports.service.ts` classifies a transaction
      // PURELY by its category's `txCoaDirection` (category-first rule),
      // so which COA the own principal category resolves to is what keeps
      // a principal repayment OFF the P&L everywhere (Ringkasan, P&L, Cash
      // Flow, Sankey, B3 reconciliation). Pinning the exact `where` here
      // means flipping this lookup to, say,
      // `{ groupNum: 2, direction: "EXPENSE" }` (an ordinary expense
      // account) fails THIS test — before, nothing in the suite could tell
      // the difference because every test just mocked the return value
      // regardless of the query used to get it.
      expect(prisma.coaAccount.findFirst).toHaveBeenCalledWith({
        where: { familyGroupId: "fg-1", groupNum: 5, direction: "TRANSFER" },
        orderBy: { code: "asc" },
      });

      // HIGH 4 — the principal category name bakes in the liability's own
      // id ("lid-1"), unlike the still-shared interest category.
      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {
          familyGroupId: "fg-1",
          name: "Utang: KTA BNI",
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

    // HIGH 10 (group E retry round 3b) — self-healing this liability's OWN
    // category must warn LOUDLY (log + persisted Notification) when its
    // PRIOR principal-payment category still carries a FIXED budget line —
    // that line's `limitAmount` likely still covers this liability's
    // contribution too, so the family's total budgeted limit is now
    // double-counted (A + 2B + C) and nothing else would ever surface it.
    it("warns loudly when self-healing finds a prior FIXED budget line still on this liability's old (shared) category", async () => {
      prisma.liability.findUnique.mockResolvedValue({
        ...LIABILITY,
        principalCategoryId: null,
      });
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
      prisma.category.findFirst.mockResolvedValueOnce(null); // interest: none exists yet either
      // First call: assertNotAlreadyPaidThisPeriod — no payment yet this
      // period. Second call: warnIfPriorSharedBudgetLine — this liability's
      // last principal payment was posted against the OLD shared category.
      prisma.transaction.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ categoryId: "cat-old-shared" });
      prisma.budget.findFirst.mockResolvedValueOnce({
        id: "budget-old-shared",
        limitAmount: BigInt(6_249_000), // e.g. A + B + C from before the split
        budgetType: "FIXED",
        category: { coaAccount: { budgetType: null } },
      });
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

      const warnSpy = jest
        .spyOn(Logger.prototype, "warn")
        .mockImplementation(() => undefined);

      await service.pay("fg-1", "lid-1", {
        sourceAccountId: "acc-1",
        amount: "5000000",
      });

      // C3 (group E retry round 4) — assert the WHERE-clause shape itself,
      // not just that some mocked return value came back: the prior version
      // of this test mocked `budget.findFirst` to return a canned value
      // regardless of its `where` clause, which is exactly why the suite
      // stayed green while the real query (`budgetType: "FIXED"` filtered
      // at the DB level, on a column nothing backfills) could never match
      // anything in production.
      expect(prisma.transaction.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: "transfer",
            OR: expect.arrayContaining([
              { liabilityId: "lid-1" },
              { description: "Pembayaran pokok KTA BNI" },
            ]),
          }),
        }),
      );
      expect(prisma.budget.findFirst).toHaveBeenCalledWith({
        where: { familyGroupId: "fg-1", categoryId: "cat-old-shared" },
        select: {
          id: true,
          limitAmount: true,
          budgetType: true,
          category: {
            select: { coaAccount: { select: { budgetType: true } } },
          },
        },
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("budget-old-shared"),
      );
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            familyGroupId: "fg-1",
            icon: "⚠️",
          }),
        }),
      );
      warnSpy.mockRestore();
    });

    // C3 (group E retry round 4) — the exact scenario the OLD version could
    // never catch: a liability that predates EITHER migration this
    // detection used to depend on. `liabilityId` is null on its prior
    // payment (E1's column, never backfilled) and `budgetType` is null on
    // its old budget row (MEDIUM 12's column, also never backfilled) — the
    // ONLY signals available are the payment's DESCRIPTION text and the
    // category's (shared) CoaAccount `budgetType`. This test fails without
    // the fix: the old query's `liabilityId: liability.id` filter finds
    // nothing (so `priorPayment` is null and the method returns early), and
    // even if it had found the row, the old `budgetType: "FIXED"` DB filter
    // would also have excluded it.
    it("detects the prior shared line via description text and the category's CoaAccount when neither liabilityId nor Budget.budgetType was ever backfilled", async () => {
      prisma.liability.findUnique.mockResolvedValue({
        ...LIABILITY,
        principalCategoryId: null,
      });
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
      prisma.category.findFirst.mockResolvedValueOnce(null);

      // Real-shaped fakes (unlike the plain `mockResolvedValueOnce` stubs
      // used elsewhere) — these actually HONOR the query's `where` clause,
      // exactly like real Postgres would: `liabilityId: null` never matches
      // `{ liabilityId: "lid-1" }`, and `budgetType: null` never matches
      // `{ budgetType: "FIXED" }`. This is what makes the test fail against
      // the OLD query (which filtered on those exact never-backfilled
      // columns) instead of merely asserting a canned return value.
      const priorTransferRow = {
        familyGroupId: "fg-1",
        type: "transfer",
        liabilityId: null, // never backfilled onto this pre-E1 row
        description: "Pembayaran pokok KTA BNI",
        categoryId: "cat-old-shared",
      };
      prisma.transaction.findFirst.mockImplementation(
        ({
          where,
        }: {
          where: {
            occurredAt?: unknown;
            type?: string;
            liabilityId?: string;
            description?: string;
            OR?: { liabilityId?: string; description?: string }[];
          };
        }) => {
          if (where.occurredAt) return Promise.resolve(null); // assertNotAlreadyPaidThisPeriod
          // A candidate matches only if EVERY field it names equals the
          // row's — an empty candidate (neither field named) never matches
          // anything, so `where.OR ?? [where]` behaves like a real WHERE.
          const candidates = where.OR ?? [where];
          const matches = candidates.some((c) => {
            const named = (["liabilityId", "description"] as const).filter(
              (k) => c[k] !== undefined,
            );
            return (
              named.length > 0 &&
              named.every((k) => c[k] === priorTransferRow[k])
            );
          });
          return Promise.resolve(matches ? priorTransferRow : null);
        },
      );

      const oldSharedBudgetRow = {
        id: "budget-old-shared",
        categoryId: "cat-old-shared",
        limitAmount: BigInt(6_249_000),
        budgetType: null, // never backfilled
        category: { coaAccount: { budgetType: "FIXED" } }, // the shared account IS FIXED
      };
      prisma.budget.findFirst.mockImplementation(
        ({
          where,
        }: {
          where: { categoryId?: string; budgetType?: string };
        }) => {
          if (where.categoryId !== oldSharedBudgetRow.categoryId) {
            return Promise.resolve(null);
          }
          // A `budgetType` filter in the WHERE clause (the old, broken
          // query) would exclude this row at the DB level — it is null.
          if (
            where.budgetType !== undefined &&
            where.budgetType !== oldSharedBudgetRow.budgetType
          ) {
            return Promise.resolve(null);
          }
          return Promise.resolve(oldSharedBudgetRow);
        },
      );
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

      const warnSpy = jest
        .spyOn(Logger.prototype, "warn")
        .mockImplementation(() => undefined);

      await service.pay("fg-1", "lid-1", {
        sourceAccountId: "acc-1",
        amount: "5000000",
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("budget-old-shared"),
      );
      warnSpy.mockRestore();
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

    // HIGH 7 (group E retry round 3b) — `purchase()`'s entire rationale
    // ("a credit card stays a liability; spending raises the card's debt
    // and leaves the bank untouched", D12) only makes sense for a
    // `kartu_kredit`. Nothing previously checked `liability.type`, so this
    // route could increment a MORTGAGE's `remainingBalance`/`totalDebt`
    // and corrupt its `paymentRatio`.
    it("rejects a purchase against a non-kartu_kredit liability (e.g. a mortgage)", async () => {
      prisma.liability.findUnique.mockResolvedValue({
        ...CARD,
        id: "kpr-1",
        type: "kpr",
      });

      await expect(
        service.purchase("fg-1", "kpr-1", { amount: "150000" }),
      ).rejects.toThrow(BadRequestException);
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

    // L9 (group E retry round 4) — `TransactionsService.create()` passes
    // the acting member's OWN `largeTxnThreshold` (D3/D9) to
    // `notifyTransaction`; `purchase()` omitted it entirely, so a card
    // charge always used the fixed 5,000,000 fallback regardless of what
    // threshold the member actually has set.
    it("passes the acting member's OWN largeTxnThreshold to notifyTransaction, not the fixed fallback", async () => {
      prisma.liability.findUnique.mockResolvedValue(CARD);
      prisma.liability.update.mockResolvedValue(CARD);
      prisma.transaction.create.mockResolvedValue({
        category: null,
        account: null,
      });
      prisma.member.findUnique.mockResolvedValue({
        largeTxnThreshold: BigInt(1_000_000),
      });

      await service.purchase(
        "fg-1",
        "card-1",
        { amount: "1500000" },
        { id: "member-1", userId: "user-1", role: "member" as never },
      );

      expect(prisma.member.findUnique).toHaveBeenCalledWith({
        where: { id: "member-1" },
        select: { largeTxnThreshold: true },
      });
      expect(transactionAlerts.notifyTransaction).toHaveBeenCalledWith(
        prisma,
        "fg-1",
        "expense",
        BigInt(1_500_000),
        expect.anything(),
        BigInt(1_000_000),
      );
    });
  });
});
