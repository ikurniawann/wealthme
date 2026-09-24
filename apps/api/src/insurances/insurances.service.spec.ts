import { BadRequestException, Logger, NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { Prisma } from "@prisma/client";

import { NOTIFICATION_SENDER_PORT } from "../notifications/notification-sender.port";
import { PrismaService } from "../prisma/prisma.service";
// H5 (group E retry round 4) — mocked at the module boundary so `pay()`'s
// (fire-and-forget) call to `checkBudgetAlert` can be asserted directly —
// mirrors liabilities.service.spec.ts's own H5 test setup.
import * as transactionAlerts from "../transactions/transaction-alerts.util";

import { InsurancesService } from "./insurances.service";

jest.mock("../transactions/transaction-alerts.util", () => ({
  checkBudgetAlert: jest.fn(),
  checkCashFlowAlert: jest.fn(),
  notifyTransaction: jest.fn(),
}));

const FAMILY_GROUP_ID = "fg-1";
const INSURANCE_ID = "ins-1";

/** Mirrors liabilities.service.spec.ts's helper for constructing Prisma errors. */
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
  // HIGH 4 — this policy already has its own premium category by default;
  // tests exercising the self-heal path override this to `null`.
  premiumCategoryId: "cat-premium",
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
  beneficiaries: [] as unknown[],
};

/**
 * `$transaction` invokes its callback with the SAME mocked client (mirrors
 * liabilities.service.spec.ts) so assertions can inspect calls made inside
 * `pay()`'s/`create()`'s/`update()`'s transaction via the same jest.fn()s,
 * and so `mockImplementationOnce` can simulate a retried attempt.
 */
function makePrisma() {
  const prisma = {
    insurance: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
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
    member: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    // EPIC-023 E1 — used inside pay()'s $transaction.
    account: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    category: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    coaAccount: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    // EPIC-023 E2 — used inside create()'s $transaction and remove().
    budget: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      // C1 (group E retry round 4) — `remove()` looks this up to decide
      // whether to refuse deletion; `findFirst` returning `null` by
      // default means "no budget line, delete freely" unless a test
      // overrides it.
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
      findFirst: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma),
  );
  return prisma;
}

describe("InsurancesService", () => {
  let service: InsurancesService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = makePrisma();
    prisma.transaction.findMany.mockResolvedValue([]);
    // BASE_ROW carries premiumCategoryId: "cat-premium" by default, so every
    // create() short-circuits resolveOwnPremiumCategoryId and goes straight
    // to markCategoryFixed's coaAccountId read — give it a safe default so
    // tests outside the "create()" describe block (which override this
    // explicitly when the budget side-effect matters) don't have to.
    prisma.category.findUniqueOrThrow.mockResolvedValue({
      coaAccountId: "coa-premium",
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InsurancesService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NOTIFICATION_SENDER_PORT,
          useValue: { send: jest.fn(), sendEmail: jest.fn() },
        },
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

  describe("paidThisPeriod", () => {
    it("is true when a premium payment landed this month", async () => {
      prisma.insurance.findMany.mockResolvedValue([{ ...BASE_ROW }]);
      prisma.transaction.findMany.mockResolvedValue([
        { insuranceId: INSURANCE_ID },
      ]);
      const [item] = await service.findAll(FAMILY_GROUP_ID);
      expect(item!.paidThisPeriod).toBe(true);
    });

    it("is false when no premium payment landed this month", async () => {
      prisma.insurance.findMany.mockResolvedValue([{ ...BASE_ROW }]);
      prisma.transaction.findMany.mockResolvedValue([]);
      const [item] = await service.findAll(FAMILY_GROUP_ID);
      expect(item!.paidThisPeriod).toBe(false);
    });
  });

  describe("create()", () => {
    beforeEach(() => {
      // HIGH 4 — `create()` mocks `prisma.insurance.create` to resolve
      // `BASE_ROW`, which already carries `premiumCategoryId: "cat-premium"`
      // — resolveOwnPremiumCategoryId short-circuits on it directly, so the
      // only lookup left is `markCategoryFixed`'s coaAccountId read.
      prisma.category.findUniqueOrThrow.mockResolvedValue({
        coaAccountId: "coa-premium",
      });
    });

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

    // LOW 7 (group E retry) — `maybeNotifyRenewal`'s best-effort catch must
    // not be silent: a systematic failure should be logged with context.
    it("logs a warning (with familyGroupId) instead of swallowing silently when the notification lookup fails", async () => {
      const warnSpy = jest
        .spyOn(Logger.prototype, "warn")
        .mockImplementation(() => undefined);
      const soon = new Date(Date.now() + 5 * 86_400_000);
      prisma.insurance.create.mockResolvedValue({
        ...BASE_ROW,
        renewalDate: soon,
      });
      prisma.member.findFirst.mockRejectedValue(new Error("db unreachable"));

      await service.create(FAMILY_GROUP_ID, {
        name: "Asuransi Jiwa",
        type: "jiwa" as const,
        premiumAmount: "1500000",
        renewalDate: soon.toISOString(),
      });

      // Wait for fire-and-forget
      await new Promise((r) => setTimeout(r, 0));

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(FAMILY_GROUP_ID),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("db unreachable"),
      );
      warnSpy.mockRestore();
    });

    // EPIC-023 E2 (D11) — a non-zero monthly-normalised premium
    // auto-creates the FIXED budget line for this policy's shared premium
    // category.
    it("auto-creates a FIXED budget line for a monthly premium", async () => {
      prisma.insurance.create.mockResolvedValue({ ...BASE_ROW });

      await service.create(FAMILY_GROUP_ID, {
        name: "Asuransi Jiwa",
        type: "jiwa" as const,
        premiumAmount: "1500000",
        premiumPeriod: "monthly" as const,
      });

      expect(prisma.budget.upsert).toHaveBeenCalledWith({
        where: {
          familyGroupId_categoryId_period: {
            familyGroupId: FAMILY_GROUP_ID,
            categoryId: "cat-premium",
            period: "monthly",
          },
        },
        create: {
          familyGroupId: FAMILY_GROUP_ID,
          categoryId: "cat-premium",
          period: "monthly",
          limitAmount: BigInt(1_500_000),
          insuranceId: INSURANCE_ID,
          budgetType: "FIXED",
        },
        update: {
          limitAmount: BigInt(1_500_000),
          insuranceId: INSURANCE_ID,
          budgetType: "FIXED",
        },
      });
    });

    // HIGH 4 — a brand-new policy with no premiumCategoryId yet self-heals
    // its OWN category (name bakes in its own id), never a shared one.
    it("self-heals its OWN premium category when the policy has none yet", async () => {
      prisma.insurance.create.mockResolvedValue({
        ...BASE_ROW,
        premiumCategoryId: null,
      });
      prisma.coaAccount.findFirst.mockResolvedValue({
        id: "coa-premium",
        code: "20010",
        name: "Premi Asuransi",
      });
      prisma.category.create.mockResolvedValue({ id: "cat-new-premium" });

      await service.create(FAMILY_GROUP_ID, {
        name: "Asuransi Jiwa",
        type: "jiwa" as const,
        premiumAmount: "1500000",
      });

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {
          familyGroupId: FAMILY_GROUP_ID,
          name: "Premi Asuransi: Asuransi Jiwa",
          kind: "expense",
          coaAccountId: "coa-premium",
        },
      });
      expect(prisma.insurance.update).toHaveBeenCalledWith({
        where: { id: INSURANCE_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { premiumCategoryId: "cat-new-premium" },
      });
    });

    // HIGH 11 (group E retry round 3b) — a family whose chart already
    // provisions the richer, purpose-built "21104" (the demo seed's own
    // insurance code) must keep using it for every NEW policy, never get
    // silently switched to the generic "20010" the backfill migration also
    // inserts for EVERY family. `findFirst({ code: { in: [...] } },
    // orderBy: { code: "asc" } })` would pick "20010" here purely because
    // "20010" < "21104" as a string — this pins that the family's PREFERRED
    // ("21104") code wins when BOTH exist, by querying each code in
    // priority order rather than sorting alphabetically.
    it("prefers the richer 21104 code over the generic 20010 when a family's chart provisions both", async () => {
      prisma.insurance.create.mockResolvedValue({
        ...BASE_ROW,
        premiumCategoryId: null,
      });
      // Both codes exist for this family — "21104" must be tried FIRST and
      // win, never "20010" (which would win under `orderBy: { code: "asc" }`
      // since "20010" < "21104" lexically).
      prisma.coaAccount.findFirst.mockImplementation(
        async ({ where }: { where: { code: string } }) => {
          if (where.code === "21104") {
            return { id: "coa-21104", name: "Asset & Other Insurance" };
          }
          if (where.code === "20010") {
            return { id: "coa-20010", name: "Premi Asuransi" };
          }
          return null;
        },
      );
      prisma.category.create.mockResolvedValue({ id: "cat-new-premium" });

      await service.create(FAMILY_GROUP_ID, {
        name: "Asuransi Jiwa",
        type: "jiwa" as const,
        premiumAmount: "1500000",
      });

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {
          familyGroupId: FAMILY_GROUP_ID,
          name: "Asset & Other Insurance: Asuransi Jiwa",
          kind: "expense",
          coaAccountId: "coa-21104",
        },
      });
    });

    it("normalises a yearly premium to its monthly contribution", async () => {
      prisma.insurance.create.mockResolvedValue({
        ...BASE_ROW,
        premiumAmount: BigInt(12_000_000),
        premiumPeriod: "yearly",
      });

      await service.create(FAMILY_GROUP_ID, {
        name: "Asuransi Jiwa",
        type: "jiwa" as const,
        premiumAmount: "12000000",
        premiumPeriod: "yearly" as const,
      });

      expect(prisma.budget.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ limitAmount: BigInt(1_000_000) }),
        }),
      );
    });
  });

  // EPIC-023 group E retry (HIGH 4) — `update()` must re-derive this
  // policy's OWN budget line whenever premiumAmount/premiumPeriod change,
  // including the two cases the old `increment`-only design silently
  // dropped: 0 -> non-zero and non-zero -> 0.
  describe("update() — budget line re-derivation", () => {
    it("throws NotFoundException when the policy does not exist", async () => {
      prisma.insurance.findUnique.mockResolvedValue(null);
      await expect(
        service.update(FAMILY_GROUP_ID, "missing-id", {
          premiumAmount: "100000",
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("premiumAmount non-zero -> non-zero RE-DERIVES limitAmount to the new value (never increments)", async () => {
      const existing = { ...BASE_ROW, premiumCategoryId: "cat-premium" };
      prisma.insurance.findUnique.mockResolvedValue(existing);
      prisma.insurance.findUniqueOrThrow.mockResolvedValue(existing);
      prisma.insurance.update.mockResolvedValue({
        ...existing,
        premiumAmount: BigInt(3_000_000),
      });

      await service.update(FAMILY_GROUP_ID, INSURANCE_ID, {
        premiumAmount: "3000000",
      });

      expect(prisma.budget.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: {
            limitAmount: BigInt(3_000_000),
            insuranceId: INSURANCE_ID,
            budgetType: "FIXED",
          },
        }),
      );
      expect(prisma.category.create).not.toHaveBeenCalled();
    });

    it("status change to non-premium-affecting field still re-derives the SAME limitAmount (no drift)", async () => {
      const existing = { ...BASE_ROW, premiumCategoryId: "cat-premium" };
      prisma.insurance.findUnique.mockResolvedValue(existing);
      prisma.insurance.findUniqueOrThrow.mockResolvedValue(existing);
      prisma.insurance.update.mockResolvedValue(existing);

      await service.update(FAMILY_GROUP_ID, INSURANCE_ID, {
        status: "tidak_aktif" as never,
      });

      expect(prisma.budget.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: {
            limitAmount: BigInt(1_500_000),
            insuranceId: INSURANCE_ID,
            budgetType: "FIXED",
          },
        }),
      );
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

    it("deletes when there is no budget line for this policy", async () => {
      prisma.insurance.findUnique.mockResolvedValue(BASE_ROW);
      prisma.budget.findFirst.mockResolvedValue(null);

      await service.remove(FAMILY_GROUP_ID, INSURANCE_ID);

      expect(prisma.insurance.delete).toHaveBeenCalledWith({
        where: { id: INSURANCE_ID, familyGroupId: FAMILY_GROUP_ID },
      });
    });

    // EPIC-023 group E retry round 4 (C1) — D11 verbatim: "Deleting a
    // liability [or policy] is refused while its budget line exists — never
    // a silent cascade." A prior version of this method silently
    // `deleteMany`'d the policy's budget line before deleting the policy —
    // exactly the cascade D11 forbids. Restored: a policy with a budget
    // line refuses deletion with a `ConflictException` naming the policy
    // and its budget line; `insurance.delete` and `budget.deleteMany` are
    // never called.
    it("refuses deletion with a ConflictException naming the policy and its budget line when one exists — never a silent cascade", async () => {
      prisma.insurance.findUnique.mockResolvedValue(BASE_ROW);
      prisma.budget.findFirst.mockResolvedValue({ id: "budget-1" });

      await expect(
        service.remove(FAMILY_GROUP_ID, INSURANCE_ID),
      ).rejects.toMatchObject({
        status: 409,
        message: expect.stringContaining(BASE_ROW.name),
      });
      await expect(
        service.remove(FAMILY_GROUP_ID, INSURANCE_ID),
      ).rejects.toMatchObject({
        message: expect.stringContaining("budget-1"),
      });
      expect(prisma.budget.deleteMany).not.toHaveBeenCalled();
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
      prisma.member.findFirst.mockResolvedValue({
        id: "member-1",
        userId: "user-5",
        familyGroupId: FAMILY_GROUP_ID,
      });
      // EPIC-023 Group F fix round (MEDIUM 8) — resolveMemberLookup's own
      // query (member.findMany) must ALSO resolve this member for the
      // link to read as live; in production it does (the same member
      // `assertMemberInFamilyGroup` above just confirmed exists).
      prisma.member.findMany.mockResolvedValue([
        { userId: "user-5", relationship: "anak", user: { name: "Anak 1" } },
      ]);
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
      expect(prisma.member.findFirst).toHaveBeenCalledWith({
        where: { userId: "user-5", familyGroupId: FAMILY_GROUP_ID },
      });
    });

    // TS review fix #1 — memberUserId must be tenant-validated the same way
    // as warisan heirs.
    it("rejects a beneficiary memberUserId that does not belong to the family group", async () => {
      // Arrange — member not found (cross-tenant or unknown user)
      prisma.member.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.create(FAMILY_GROUP_ID, {
          name: "Asuransi Jiwa",
          type: "jiwa" as const,
          premiumAmount: "1500000",
          beneficiaries: [
            {
              name: "Anak 1",
              relationship: "Anak",
              sharePercent: 60,
              memberUserId: "someone-elses-user-id",
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.insurance.create).not.toHaveBeenCalled();
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

    it("rejects an update whose beneficiary memberUserId does not belong to the family group", async () => {
      // Arrange
      prisma.insurance.findUnique.mockResolvedValue({ ...BASE_ROW });
      prisma.member.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.update(FAMILY_GROUP_ID, INSURANCE_ID, {
          beneficiaries: [
            {
              name: "Anak 1",
              relationship: "Anak",
              sharePercent: 60,
              memberUserId: "cross-tenant-user",
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.insurance.update).not.toHaveBeenCalled();
    });
  });

  // EPIC-023 F1 (D14, US-INS-5) — a beneficiary linked to a family member
  // resolves its displayed name/relationship from the member's CURRENT
  // record, not the copy stored on the beneficiary row. Fails against
  // pre-F1 code, which always echoed the stored name/relationship.
  describe("live-linked beneficiaries (F1)", () => {
    it("findAll() resolves name/relationship from the CURRENT member record, overriding the stored copy", async () => {
      // Arrange — stored row still says "Anak 1" / "Anak" (stale), but the
      // member's live name/relationship have since changed.
      prisma.insurance.findMany.mockResolvedValue([
        {
          ...BASE_ROW,
          beneficiaries: [
            {
              id: "ben-1",
              insuranceId: INSURANCE_ID,
              name: "Anak 1 (stale)",
              relationship: "Anak (stale)",
              sharePercent: { toString: () => "60.00" },
              memberUserId: "user-5",
              createdAt: new Date("2024-01-01T00:00:00.000Z"),
            },
          ],
        },
      ]);
      prisma.member.findMany.mockResolvedValue([
        { userId: "user-5", relationship: "anak", user: { name: "Budi Baru" } },
      ]);

      // Act
      const [item] = await service.findAll(FAMILY_GROUP_ID);

      // Assert
      expect(item!.beneficiaries[0]!.name).toBe("Budi Baru");
      expect(item!.beneficiaries[0]!.relationship).toBe("anak");
      expect(prisma.member.findMany).toHaveBeenCalledWith({
        where: { familyGroupId: FAMILY_GROUP_ID, userId: { in: ["user-5"] } },
        include: { user: { select: { name: true } } },
      });
    });

    it("findAll() keeps the free-text name/relationship for a non-member beneficiary", async () => {
      // Arrange
      prisma.insurance.findMany.mockResolvedValue([
        {
          ...BASE_ROW,
          beneficiaries: [
            {
              id: "ben-1",
              insuranceId: INSURANCE_ID,
              name: "Bibi Jauh",
              relationship: "Kerabat",
              sharePercent: { toString: () => "40.00" },
              memberUserId: null,
              createdAt: new Date("2024-01-01T00:00:00.000Z"),
            },
          ],
        },
      ]);

      // Act
      const [item] = await service.findAll(FAMILY_GROUP_ID);

      // Assert — no member lookup query at all for an unlinked beneficiary.
      expect(item!.beneficiaries[0]!.name).toBe("Bibi Jauh");
      expect(item!.beneficiaries[0]!.relationship).toBe("Kerabat");
      expect(prisma.member.findMany).not.toHaveBeenCalled();
    });

    // EPIC-023 Group F fix round (MEDIUM 8) — a beneficiary whose linked
    // member was removed from the family must not keep reading as a live
    // link: `memberUserId` is nulled out, and the last-known copy is shown.
    it("findAll() nulls memberUserId when the linked member no longer resolves (orphaned link)", async () => {
      prisma.insurance.findMany.mockResolvedValue([
        {
          ...BASE_ROW,
          beneficiaries: [
            {
              id: "ben-1",
              insuranceId: INSURANCE_ID,
              name: "Anak 1 (last known)",
              relationship: "Anak (last known)",
              sharePercent: { toString: () => "60.00" },
              memberUserId: "user-removed",
              createdAt: new Date("2024-01-01T00:00:00.000Z"),
            },
          ],
        },
      ]);
      // The member was removed — resolveMemberLookup's query finds nothing.
      prisma.member.findMany.mockResolvedValue([]);

      const [item] = await service.findAll(FAMILY_GROUP_ID);

      expect(item!.beneficiaries[0]!.memberUserId).toBeNull();
      expect(item!.beneficiaries[0]!.name).toBe("Anak 1 (last known)");
      expect(item!.beneficiaries[0]!.relationship).toBe("Anak (last known)");
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

  // EPIC-023 E1 — paying a premium creates ONE linked (insuranceId)
  // transaction, debits the source account, and advances renewalDate by one
  // premium period. All inside `pay()`'s one `$transaction`.
  describe("pay", () => {
    // H8 (group E retry round 4) — `assertNotAlreadyPaidThisPeriod` now
    // rejects a payment outright when `renewalDate` is already in the
    // FUTURE relative to "now" (already paid ahead) — so these tests fix
    // "now" and give `POLICY` a `renewalDate` that is DUE (one day before
    // "now"), never in the future, unless a test explicitly overrides it
    // to exercise a specific renewalDate scenario. `NOW` also replaces the
    // old convention of keeping `renewalDate` arbitrarily far in the
    // future (2099) purely to dodge the MEDIUM 13 "overdue" anchor branch —
    // that convention is what H8's fix would otherwise reject outright.
    const NOW = new Date("2026-06-15T00:00:00.000Z");

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(NOW);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    const POLICY = {
      ...BASE_ROW,
      premiumAmount: BigInt(1_500_000),
      premiumPeriod: "monthly" as const,
      // One day before `NOW` — DUE, never overdue by more than a day, and
      // never in the future (H8's new fast-reject only fires on the
      // latter). MEDIUM 13's anchor (`max(renewalDate, now)`) becomes `now`
      // here, matching the "paying on time" path these tests exercise.
      renewalDate: new Date("2026-06-14T00:00:00.000Z"),
    };
    const ACCOUNT = {
      id: "acc-1",
      familyGroupId: FAMILY_GROUP_ID,
      type: "bank",
      balance: BigInt(10_000_000),
      name: "BCA",
    };

    // C3 (group E retry round 4) — server-side idempotency: a second premium
    // payment for the SAME policy within the current period must be
    // rejected, not merely disabled client-side (a client-side `disabled`
    // cannot be the whole control on a money path — see /asuransi's missing
    // disabled state, fixed separately on the web side). This is the ONLY
    // thing that stops a double debit from a second tab, a stale page, a
    // replayed request, or a direct API call.
    it("rejects a second premium payment for the same policy within the current period", async () => {
      prisma.insurance.findUnique.mockResolvedValue(POLICY);
      prisma.transaction.findFirst.mockResolvedValue({ id: "tx-existing" });

      await expect(
        service.pay(FAMILY_GROUP_ID, INSURANCE_ID, {
          sourceAccountId: "acc-1",
        }),
      ).rejects.toMatchObject({ status: 409 });
      expect(prisma.account.findUnique).not.toHaveBeenCalled();
      expect(prisma.account.update).not.toHaveBeenCalled();
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the policy does not exist in this family group", async () => {
      prisma.insurance.findUnique.mockResolvedValue(null);
      await expect(
        service.pay(FAMILY_GROUP_ID, "missing-id", {
          sourceAccountId: "acc-1",
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.account.update).not.toHaveBeenCalled();
    });

    it("rejects a source account from another family group (tenant scoping)", async () => {
      prisma.insurance.findUnique.mockResolvedValue(POLICY);
      prisma.account.findUnique.mockResolvedValue(null);

      await expect(
        service.pay(FAMILY_GROUP_ID, INSURANCE_ID, {
          sourceAccountId: "acc-other-family",
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.account.update).not.toHaveBeenCalled();
      expect(prisma.insurance.update).not.toHaveBeenCalled();
    });

    it("defaults amount to the policy's premiumAmount, debits the account, links insuranceId, and advances renewalDate by one period", async () => {
      prisma.insurance.findUnique.mockResolvedValue(POLICY);
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
      prisma.insurance.update.mockResolvedValue({
        ...POLICY,
        renewalDate: new Date("2026-07-15T00:00:00.000Z"),
      });

      const result = await service.pay(FAMILY_GROUP_ID, INSURANCE_ID, {
        sourceAccountId: "acc-1",
      });

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: "acc-1", familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { decrement: BigInt(1_500_000) } },
      });
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            familyGroupId: FAMILY_GROUP_ID,
            accountId: "acc-1",
            categoryId: "cat-premium",
            amount: BigInt(1_500_000),
            type: "expense",
            insuranceId: INSURANCE_ID,
          }),
        }),
      );
      // Golden value — MEDIUM 13's anchor is `max(renewalDate, now)`; the
      // fixture's `renewalDate` (2026-06-14) is one day before `NOW`
      // (2026-06-15), so the anchor is `NOW` — advancing one month lands on
      // 2026-07-15, same clamped-advance algorithm as
      // next-renewal-date.util.spec.ts's "advances a mid-month date by one
      // month" case.
      expect(prisma.insurance.update).toHaveBeenCalledWith({
        where: { id: INSURANCE_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { renewalDate: new Date("2026-07-15T00:00:00.000Z") },
      });
      expect(result.renewalDate).toBe("2026-07-15T00:00:00.000Z");
    });

    it("uses an explicit amount instead of the policy's premiumAmount when provided", async () => {
      prisma.insurance.findUnique.mockResolvedValue(POLICY);
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
      prisma.insurance.update.mockResolvedValue(POLICY);

      await service.pay(FAMILY_GROUP_ID, INSURANCE_ID, {
        sourceAccountId: "acc-1",
        amount: "2000000",
      });

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: "acc-1", familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { decrement: BigInt(2_000_000) } },
      });
    });

    // H5 (group E retry round 4) — mirrors LiabilitiesService.pay()'s own
    // H5 fix: `pay()` never fired `checkBudgetAlert`, so a FIXED premium
    // line paid past its `limitAmount` never raised an 80%/100% alert.
    it("fires checkBudgetAlert for the policy's own premium category after a successful payment", async () => {
      prisma.insurance.findUnique.mockResolvedValue(POLICY);
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
      prisma.insurance.update.mockResolvedValue(POLICY);

      await service.pay(FAMILY_GROUP_ID, INSURANCE_ID, {
        sourceAccountId: "acc-1",
      });

      expect(transactionAlerts.checkBudgetAlert).toHaveBeenCalledWith(
        prisma,
        expect.anything(),
        FAMILY_GROUP_ID,
        "cat-premium",
      );
    });

    it("leaves renewalDate untouched when the policy has none set", async () => {
      prisma.insurance.findUnique.mockResolvedValue({
        ...POLICY,
        renewalDate: null,
      });
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
      prisma.insurance.update.mockResolvedValue({
        ...POLICY,
        renewalDate: null,
      });

      await service.pay(FAMILY_GROUP_ID, INSURANCE_ID, {
        sourceAccountId: "acc-1",
      });

      expect(prisma.insurance.update).toHaveBeenCalledWith({
        where: { id: INSURANCE_ID, familyGroupId: FAMILY_GROUP_ID },
        data: {},
      });
    });

    // H8 (group E retry round 4) — the runtime-proved regression: a YEARLY
    // policy paid 20 Dec 2025 (renewalDate -> Dec 2026) must NOT be payable
    // again just because a NEW calendar year (or month/quarter) started.
    // The old, purely calendar-anchored guard reset at every calendar
    // boundary regardless of the obligation's own paid-through date, so it
    // accepted a second full annual premium 11 months early. `renewalDate`
    // already IN THE FUTURE relative to "now" is decisive on its own.
    it("rejects a second payment when renewalDate is already in the future, even in a NEW calendar month/quarter/year (H8)", async () => {
      prisma.insurance.findUnique.mockResolvedValue({
        ...POLICY,
        premiumPeriod: "yearly" as const,
        // Paid 20 Dec 2025, advanced to Dec 2026 — almost a full year still
        // ahead of `NOW` (2026-06-15), which is itself in a DIFFERENT
        // calendar year than the payment that set this renewalDate.
        renewalDate: new Date("2026-12-20T00:00:00.000Z"),
      });

      await expect(
        service.pay(FAMILY_GROUP_ID, INSURANCE_ID, {
          sourceAccountId: "acc-1",
        }),
      ).rejects.toMatchObject({ status: 409 });
      expect(prisma.account.findUnique).not.toHaveBeenCalled();
      expect(prisma.account.update).not.toHaveBeenCalled();
      expect(prisma.transaction.create).not.toHaveBeenCalled();
      // Decisive on `renewalDate` alone — never even needs to query for a
      // same-period Transaction row (the old, broken signal).
      expect(prisma.transaction.findFirst).not.toHaveBeenCalled();
    });

    // MEDIUM 13 (group E retry round 3b) — a monthly policy 3 months
    // overdue, paid today, must advance renewalDate ONE period from TODAY
    // (so `billing-cycle.processor.ts`'s catch-up has nothing left to
    // correct), never one period from the stale, long-past stored
    // `renewalDate` — the bug this anchor fixes: unconditionally advancing
    // from the stale date left it still in the past, and the NEXT
    // catch-up run would then advance it several more periods on top,
    // compounding into "one payment silently advanced the renewal by four
    // months".
    it("anchors the advance to TODAY (not the stale date) when the policy is overdue", async () => {
      jest.useFakeTimers().setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
      try {
        const overdue = {
          ...POLICY,
          renewalDate: new Date("2026-03-15T00:00:00.000Z"), // 3 months overdue
        };
        prisma.insurance.findUnique.mockResolvedValue(overdue);
        prisma.account.findUnique.mockResolvedValue(ACCOUNT);
        prisma.insurance.update.mockResolvedValue({
          ...overdue,
          renewalDate: new Date("2026-07-15T00:00:00.000Z"),
        });

        await service.pay(FAMILY_GROUP_ID, INSURANCE_ID, {
          sourceAccountId: "acc-1",
        });

        // Anchored to today (2026-06-15) + one month = 2026-07-15. NEVER
        // anchored to the stale stored renewalDate (2026-03-15) + one
        // month = 2026-04-15, which would still be in the past.
        expect(prisma.insurance.update).toHaveBeenCalledWith({
          where: { id: INSURANCE_ID, familyGroupId: FAMILY_GROUP_ID },
          data: { renewalDate: new Date("2026-07-15T00:00:00.000Z") },
        });
      } finally {
        jest.useRealTimers();
      }
    });

    it("self-heals by creating its OWN premium expense category when it has none yet (premiumCategoryId: null)", async () => {
      prisma.insurance.findUnique.mockResolvedValue({
        ...POLICY,
        premiumCategoryId: null,
      });
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
      prisma.coaAccount.findFirst.mockResolvedValue({
        id: "coa-premium",
        code: "20010",
        name: "Premi Asuransi",
      });
      prisma.category.create.mockResolvedValue({ id: "cat-new-premium" });
      prisma.insurance.update.mockResolvedValue(POLICY);

      await service.pay(FAMILY_GROUP_ID, INSURANCE_ID, {
        sourceAccountId: "acc-1",
      });

      // HIGH 4 — the category name bakes in the policy's OWN id.
      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {
          familyGroupId: FAMILY_GROUP_ID,
          name: "Premi Asuransi: Asuransi Jiwa",
          kind: "expense",
          coaAccountId: "coa-premium",
        },
      });
      expect(prisma.insurance.update).toHaveBeenCalledWith({
        where: { id: INSURANCE_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { premiumCategoryId: "cat-new-premium" },
      });
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ categoryId: "cat-new-premium" }),
        }),
      );
    });

    // H6 (group E retry round 4) — mirrors
    // `LiabilitiesService.warnIfPriorSharedBudgetLine` (fixed by C3): the
    // insurance side had NO such warning at all before this fix. Self-
    // healing this policy's OWN category must warn LOUDLY (log + persisted
    // Notification) when its PRIOR premium-payment category still carries
    // a FIXED budget line.
    it("warns loudly when self-healing finds a prior FIXED budget line still on this policy's old (shared) category", async () => {
      prisma.insurance.findUnique.mockResolvedValue({
        ...POLICY,
        premiumCategoryId: null,
      });
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
      // First call: assertNotAlreadyPaidThisPeriod — no payment yet this
      // period. Second call: warnIfPriorSharedBudgetLine — this policy's
      // last premium payment was posted against the OLD shared category.
      prisma.transaction.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ categoryId: "cat-old-shared" });
      prisma.budget.findFirst.mockResolvedValueOnce({
        id: "budget-old-shared",
        limitAmount: BigInt(4_500_000),
        budgetType: "FIXED",
        category: { coaAccount: { budgetType: null } },
      });
      prisma.coaAccount.findFirst.mockResolvedValue({
        id: "coa-premium",
        code: "20010",
        name: "Premi Asuransi",
      });
      prisma.category.create.mockResolvedValue({ id: "cat-new-premium" });
      prisma.insurance.update.mockResolvedValue(POLICY);

      const warnSpy = jest
        .spyOn(Logger.prototype, "warn")
        .mockImplementation(() => undefined);

      await service.pay(FAMILY_GROUP_ID, INSURANCE_ID, {
        sourceAccountId: "acc-1",
      });

      // Assert the WHERE-clause shape itself — mirrors the liability-side
      // C3 assertion so this warning can never regress the same way.
      expect(prisma.transaction.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: "expense",
            OR: expect.arrayContaining([
              { insuranceId: INSURANCE_ID },
              { description: "Premi Asuransi Jiwa" },
            ]),
          }),
        }),
      );
      expect(prisma.budget.findFirst).toHaveBeenCalledWith({
        where: { familyGroupId: FAMILY_GROUP_ID, categoryId: "cat-old-shared" },
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
            familyGroupId: FAMILY_GROUP_ID,
            icon: "⚠️",
          }),
        }),
      );
      warnSpy.mockRestore();
    });

    // HIGH — EPIC-021 #22's bank-overdraft floor must apply to insurance
    // premium payments exactly like every other fresh debit.
    it("rejects a payment from a bank account whose balance would go below zero (EPIC-021 #22)", async () => {
      prisma.insurance.findUnique.mockResolvedValue(POLICY);
      prisma.account.findUnique.mockResolvedValue({
        ...ACCOUNT,
        balance: BigInt(1_000_000),
      });

      await expect(
        service.pay(FAMILY_GROUP_ID, INSURANCE_ID, {
          sourceAccountId: "acc-1",
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.account.update).not.toHaveBeenCalled();
      expect(prisma.insurance.update).not.toHaveBeenCalled();
    });

    // CRITICAL/HIGH 2 (group E retry) — `pay()`'s docblock used to claim
    // Serializable isolation was unnecessary because "the account debit is
    // an atomic decrement". False: `assertBankNotOverdrawn` READS the
    // balance then `account.update({ decrement })` WRITES — the same
    // read-then-write pair `LiabilitiesService.pay()` already needed
    // Serializable-plus-retry for. This proves the retry actually runs.
    it("retries once on a P2034 serialization failure and succeeds on the second attempt", async () => {
      prisma.insurance.findUnique.mockResolvedValue(POLICY);
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
      prisma.insurance.update.mockResolvedValue(POLICY);
      prisma.$transaction.mockImplementationOnce(() =>
        Promise.reject(serializationFailure()),
      );

      const result = await service.pay(FAMILY_GROUP_ID, INSURANCE_ID, {
        sourceAccountId: "acc-1",
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(result.id).toBe(INSURANCE_ID);
    });

    it("gives up and surfaces the P2034 once every retry attempt loses the conflict", async () => {
      prisma.insurance.findUnique.mockResolvedValue(POLICY);
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
      prisma.$transaction.mockImplementation(() =>
        Promise.reject(serializationFailure()),
      );

      await expect(
        service.pay(FAMILY_GROUP_ID, INSURANCE_ID, {
          sourceAccountId: "acc-1",
        }),
      ).rejects.toThrow(Prisma.PrismaClientKnownRequestError);
      // Bounded: exactly 3 attempts, not an infinite/unbounded retry loop.
      expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    });

    // HIGH 2 — a first-ever concurrent premium payment used to throw an
    // opaque, unretried 500 from the category self-heal P2002 race; it now
    // retries exactly like `LiabilitiesService.pay()`.
    it("retries the whole transaction on a concurrent own-category self-heal race (P2002), succeeding once the retry sees the winner's committed category", async () => {
      prisma.insurance.findUnique
        .mockResolvedValueOnce({ ...POLICY, premiumCategoryId: null }) // attempt 1: no own category yet
        .mockResolvedValueOnce({
          ...POLICY,
          premiumCategoryId: "cat-premium",
        }); // attempt 2: the winning concurrent call already committed it
      prisma.account.findUnique.mockResolvedValue(ACCOUNT);
      prisma.coaAccount.findFirst.mockResolvedValueOnce({
        id: "coa-premium",
        code: "20010",
        name: "Premi Asuransi",
      });
      prisma.category.create.mockRejectedValueOnce(uniqueViolation());
      prisma.insurance.update.mockResolvedValue(POLICY);

      const result = await service.pay(FAMILY_GROUP_ID, INSURANCE_ID, {
        sourceAccountId: "acc-1",
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(prisma.category.create).toHaveBeenCalledTimes(1);
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ categoryId: "cat-premium" }),
        }),
      );
      expect(result.id).toBe(INSURANCE_ID);
    });
  });
});
