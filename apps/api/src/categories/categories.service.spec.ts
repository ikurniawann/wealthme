import { Test, type TestingModule } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";

import { CategoriesService } from "./categories.service";

const FAMILY_GROUP_ID = "fg-1";
const CATEGORY_ID = "cat-1";

function makePrisma() {
  return {
    category: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
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
