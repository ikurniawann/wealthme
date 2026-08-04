import { Test, type TestingModule } from "@nestjs/testing";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

import { CategoriesService } from "./categories.service";

const FAMILY_GROUP_ID = "fg-1";
const CATEGORY_ID = "cat-1";

function makePrisma() {
  const prisma = {
    category: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    // EPIC-017: create/update resolve a COA link via coaAccount.findFirst.
    coaAccount: {
      findFirst: jest.fn().mockResolvedValue({ id: "coa-1" }),
    },
    // EPIC-022 A5 — dependant counts guarding `remove`.
    budget: {
      count: jest.fn().mockResolvedValue(0),
    },
    memberCategoryAllowance: {
      count: jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn(),
  };
  // EPIC-022 A5 follow-up — `remove()` now runs the count-and-delete inside
  // a Serializable `$transaction`; this fake just invokes the callback with
  // the same mock object (the `tx` handed to real Prisma callbacks has the
  // identical shape), so every existing assertion on `prisma.category.delete`
  // etc. keeps working unmodified.
  prisma.$transaction.mockImplementation(
    (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma),
  );
  return prisma;
}

describe("CategoriesService", () => {
  let service: CategoriesService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(CategoriesService);
  });

  describe("create", () => {
    it("defaults isPrivate to false when not provided", async () => {
      prisma.category.create.mockResolvedValue({
        id: CATEGORY_ID,
        familyGroupId: FAMILY_GROUP_ID,
        name: "Groceries",
        kind: "expense",
        color: null,
        icon: null,
        isPrivate: false,
        createdAt: new Date(),
      });

      await service.create(FAMILY_GROUP_ID, {
        name: "Groceries",
        kind: "expense",
      });

      expect(prisma.category.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isPrivate: false }),
        }),
      );
    });

    it("persists isPrivate: true when set by the owner", async () => {
      prisma.category.create.mockResolvedValue({
        id: CATEGORY_ID,
        familyGroupId: FAMILY_GROUP_ID,
        name: "Personal",
        kind: "expense",
        color: null,
        icon: null,
        isPrivate: true,
        createdAt: new Date(),
      });

      const result = await service.create(FAMILY_GROUP_ID, {
        name: "Personal",
        kind: "expense",
        isPrivate: true,
      });

      expect(prisma.category.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isPrivate: true }),
        }),
      );
      expect(result.isPrivate).toBe(true);
    });

    it("rejects a coaAccountId that is not in the family group (tenant scope)", async () => {
      prisma.coaAccount.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.create(FAMILY_GROUP_ID, {
          name: "Groceries",
          kind: "expense",
          coaAccountId: "coa-from-another-tenant",
        }),
      ).rejects.toThrow();

      expect(prisma.category.create).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("persists a toggled isPrivate flag", async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: CATEGORY_ID,
        familyGroupId: FAMILY_GROUP_ID,
      });
      prisma.category.update.mockResolvedValue({
        id: CATEGORY_ID,
        familyGroupId: FAMILY_GROUP_ID,
        name: "Personal",
        kind: "expense",
        color: null,
        icon: null,
        isPrivate: true,
        createdAt: new Date(),
      });

      const result = await service.update(FAMILY_GROUP_ID, CATEGORY_ID, {
        isPrivate: true,
      });

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: CATEGORY_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { isPrivate: true },
      });
      expect(result.isPrivate).toBe(true);
    });

    it("leaves isPrivate untouched when not provided in the patch", async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: CATEGORY_ID,
        familyGroupId: FAMILY_GROUP_ID,
      });
      prisma.category.update.mockResolvedValue({
        id: CATEGORY_ID,
        familyGroupId: FAMILY_GROUP_ID,
        name: "Renamed",
        kind: "expense",
        color: null,
        icon: null,
        isPrivate: false,
        createdAt: new Date(),
      });

      await service.update(FAMILY_GROUP_ID, CATEGORY_ID, {
        name: "Renamed",
      });

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: CATEGORY_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { name: "Renamed" },
      });
    });
  });

  describe("remove (EPIC-022 A5 — dependant guard)", () => {
    beforeEach(() => {
      prisma.category.findUnique.mockResolvedValue({
        id: CATEGORY_ID,
        familyGroupId: FAMILY_GROUP_ID,
      });
    });

    it("deletes the category when nothing depends on it", async () => {
      await service.remove(FAMILY_GROUP_ID, CATEGORY_ID);

      expect(prisma.category.delete).toHaveBeenCalledWith({
        where: { id: CATEGORY_ID, familyGroupId: FAMILY_GROUP_ID },
      });
    });

    it("rejects with a 409 naming the budgets attached, and never deletes", async () => {
      prisma.budget.count.mockResolvedValue(2);

      await expect(
        service.remove(FAMILY_GROUP_ID, CATEGORY_ID),
      ).rejects.toMatchObject({
        status: 409,
        message: expect.stringContaining("2 anggaran"),
      });
      expect(prisma.category.delete).not.toHaveBeenCalled();
    });

    it("rejects with a 409 naming the member allowances attached, and never deletes", async () => {
      prisma.memberCategoryAllowance.count.mockResolvedValue(1);

      await expect(
        service.remove(FAMILY_GROUP_ID, CATEGORY_ID),
      ).rejects.toMatchObject({
        status: 409,
        message: expect.stringContaining("1 batasan kategori anggota"),
      });
      expect(prisma.category.delete).not.toHaveBeenCalled();
    });

    it("names both budgets and allowances when both are attached", async () => {
      prisma.budget.count.mockResolvedValue(3);
      prisma.memberCategoryAllowance.count.mockResolvedValue(2);

      await expect(
        service.remove(FAMILY_GROUP_ID, CATEGORY_ID),
      ).rejects.toMatchObject({
        message: expect.stringContaining(
          "3 anggaran dan 2 batasan kategori anggota",
        ),
      });
      expect(prisma.category.delete).not.toHaveBeenCalled();
    });

    it("still 404s on a category that does not exist, before counting dependants", async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.remove(FAMILY_GROUP_ID, "nonexistent"),
      ).rejects.toMatchObject({ status: 404 });
      expect(prisma.budget.count).not.toHaveBeenCalled();
    });

    it("runs the count-and-delete inside a single Serializable $transaction (EPIC-022 A5 follow-up — closes the check-then-act race)", async () => {
      await service.remove(FAMILY_GROUP_ID, CATEGORY_ID);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const [, options] = prisma.$transaction.mock.calls[0] as [
        unknown,
        { isolationLevel?: string },
      ];
      expect(options?.isolationLevel).toBe("Serializable");
      // The count and the delete both ran inside that one transaction call,
      // not as separate, independently-awaited round trips.
      expect(prisma.budget.count).toHaveBeenCalledTimes(1);
      expect(prisma.category.delete).toHaveBeenCalledTimes(1);
    });

    it("maps a P2034 serialization failure to a retryable 409 with an honest 'try again' message, not the generic 500 (EPIC-022 A5 follow-up)", async () => {
      // Simulates exactly what Postgres/Prisma raise when the Serializable
      // transaction above detects the write conflict it exists to catch — a
      // Budget/MemberCategoryAllowance committed concurrently mid-delete.
      prisma.$transaction.mockImplementationOnce(() => {
        throw new Prisma.PrismaClientKnownRequestError(
          "Transaction failed due to a write conflict or a deadlock. Please retry your transaction",
          { code: "P2034", clientVersion: "6.19.3" },
        );
      });

      await expect(
        service.remove(FAMILY_GROUP_ID, CATEGORY_ID),
      ).rejects.toMatchObject({
        status: 409,
        message: expect.stringContaining("Coba lagi"),
      });
    });

    it("does not swallow other Prisma errors behind the P2034 retry message", async () => {
      prisma.$transaction.mockImplementationOnce(() => {
        throw new Prisma.PrismaClientKnownRequestError("Some other failure", {
          code: "P2025",
          clientVersion: "6.19.3",
        });
      });

      await expect(
        service.remove(FAMILY_GROUP_ID, CATEGORY_ID),
      ).rejects.toThrow("Some other failure");
    });
  });
});

interface FakeCategory {
  id: string;
  familyGroupId: string;
  name: string;
  kind: string;
  color: string | null;
  icon: string | null;
  isPrivate: boolean;
  createdAt: Date;
}

const PRIVATE_CATEGORY_ID = "cat-private";

function buildFixtureCategories(): FakeCategory[] {
  const now = new Date();
  return [
    {
      id: CATEGORY_ID,
      familyGroupId: FAMILY_GROUP_ID,
      name: "Groceries",
      kind: "expense",
      color: null,
      icon: null,
      isPrivate: false,
      createdAt: now,
    },
    {
      id: PRIVATE_CATEGORY_ID,
      familyGroupId: FAMILY_GROUP_ID,
      name: "Personal",
      kind: "expense",
      color: null,
      icon: null,
      isPrivate: true,
      createdAt: now,
    },
  ];
}

/**
 * A minimal in-memory Prisma stand-in that honors the `isPrivate` filter the
 * service builds via `categoryPrivacyWhere`, so these tests exercise real
 * filtering behavior rather than just call shapes.
 */
function makeFakeFindManyPrisma(categories: FakeCategory[]) {
  return {
    category: {
      findMany: jest.fn(({ where }: { where: { isPrivate?: boolean } }) => {
        const rows =
          where.isPrivate === false
            ? categories.filter((c) => !c.isPrivate)
            : categories;
        return Promise.resolve(rows);
      }),
    },
  };
}

describe("CategoriesService privacy enforcement", () => {
  let service: CategoriesService;
  let prisma: ReturnType<typeof makeFakeFindManyPrisma>;

  beforeEach(async () => {
    prisma = makeFakeFindManyPrisma(buildFixtureCategories());
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(CategoriesService);
  });

  it("findAll excludes private categories for a member viewer", async () => {
    const result = await service.findAll(FAMILY_GROUP_ID, false);
    expect(result.map((c) => c.id)).toEqual([CATEGORY_ID]);
  });

  it("findAll includes private categories for an owner/admin_staff viewer", async () => {
    const result = await service.findAll(FAMILY_GROUP_ID, true);
    expect(result.map((c) => c.id).sort()).toEqual(
      [CATEGORY_ID, PRIVATE_CATEGORY_ID].sort(),
    );
  });

  it("findAll defaults to unfiltered when canSeePrivate is omitted (internal callers)", async () => {
    const result = await service.findAll(FAMILY_GROUP_ID);
    expect(result.map((c) => c.id).sort()).toEqual(
      [CATEGORY_ID, PRIVATE_CATEGORY_ID].sort(),
    );
  });
});
