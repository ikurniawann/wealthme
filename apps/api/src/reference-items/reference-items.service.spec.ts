import { Test, type TestingModule } from "@nestjs/testing";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

import { ReferenceItemsService } from "./reference-items.service";

const FAMILY_GROUP_ID = "fg-1";
const OTHER_FAMILY_GROUP_ID = "fg-2";
const ITEM_ID = "ref-1";

function makePrisma() {
  return {
    referenceItem: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  };
}

describe("ReferenceItemsService", () => {
  let service: ReferenceItemsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferenceItemsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(ReferenceItemsService);
  });

  describe("findAll", () => {
    it("lists every group's items for the family, sorted by group then sortOrder", async () => {
      prisma.referenceItem.findMany.mockResolvedValue([]);

      await service.findAll(FAMILY_GROUP_ID);

      expect(prisma.referenceItem.findMany).toHaveBeenCalledWith({
        where: { familyGroupId: FAMILY_GROUP_ID },
        orderBy: [{ group: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
      });
    });

    it("narrows to one group when `group` is provided", async () => {
      prisma.referenceItem.findMany.mockResolvedValue([]);

      await service.findAll(FAMILY_GROUP_ID, "bank");

      expect(prisma.referenceItem.findMany).toHaveBeenCalledWith({
        where: { familyGroupId: FAMILY_GROUP_ID, group: "bank" },
        orderBy: [{ group: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
      });
    });

    it("tenant-scopes strictly to the given familyGroupId (never returns another tenant's rows)", async () => {
      prisma.referenceItem.findMany.mockResolvedValue([
        {
          id: ITEM_ID,
          familyGroupId: FAMILY_GROUP_ID,
          group: "bank",
          label: "BCA",
          sortOrder: 0,
          isSystem: true,
          createdAt: new Date(),
        },
      ]);

      const result = await service.findAll(FAMILY_GROUP_ID);

      expect(result.every((r) => r.familyGroupId === FAMILY_GROUP_ID)).toBe(
        true,
      );
      expect(prisma.referenceItem.findMany).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            familyGroupId: OTHER_FAMILY_GROUP_ID,
          }),
        }),
      );
    });
  });

  describe("create", () => {
    it("appends after the current max sortOrder within the group", async () => {
      prisma.referenceItem.findFirst.mockResolvedValue({ sortOrder: 5 });
      prisma.referenceItem.create.mockResolvedValue({
        id: ITEM_ID,
        familyGroupId: FAMILY_GROUP_ID,
        group: "bank",
        label: "Bank Jago",
        sortOrder: 6,
        isSystem: false,
        createdAt: new Date(),
      });

      const result = await service.create(FAMILY_GROUP_ID, "bank", "Bank Jago");

      expect(prisma.referenceItem.create).toHaveBeenCalledWith({
        data: {
          familyGroupId: FAMILY_GROUP_ID,
          group: "bank",
          label: "Bank Jago",
          sortOrder: 6,
          isSystem: false,
        },
      });
      expect(result.isSystem).toBe(false);
    });

    it("starts at sortOrder 0 when the group is empty", async () => {
      prisma.referenceItem.findFirst.mockResolvedValue(null);
      prisma.referenceItem.create.mockResolvedValue({
        id: ITEM_ID,
        familyGroupId: FAMILY_GROUP_ID,
        group: "lembaga",
        label: "Kitabisa",
        sortOrder: 0,
        isSystem: false,
        createdAt: new Date(),
      });

      await service.create(FAMILY_GROUP_ID, "lembaga", "Kitabisa");

      expect(prisma.referenceItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sortOrder: 0 }),
        }),
      );
    });

    it("trims the label before persisting", async () => {
      prisma.referenceItem.findFirst.mockResolvedValue(null);
      prisma.referenceItem.create.mockResolvedValue({
        id: ITEM_ID,
        familyGroupId: FAMILY_GROUP_ID,
        group: "ewallet",
        label: "Jenius Pay",
        sortOrder: 0,
        isSystem: false,
        createdAt: new Date(),
      });

      await service.create(FAMILY_GROUP_ID, "ewallet", "  Jenius Pay  ");

      expect(prisma.referenceItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ label: "Jenius Pay" }),
        }),
      );
    });

    it("rejects a duplicate label within the same (familyGroupId, group) as a 409", async () => {
      prisma.referenceItem.findFirst.mockResolvedValue(null);
      prisma.referenceItem.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "6.19.3",
        }),
      );

      await expect(
        service.create(FAMILY_GROUP_ID, "bank", "BCA"),
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  describe("remove", () => {
    it("deletes a non-system item", async () => {
      prisma.referenceItem.findUnique.mockResolvedValue({
        id: ITEM_ID,
        familyGroupId: FAMILY_GROUP_ID,
        isSystem: false,
      });

      await service.remove(FAMILY_GROUP_ID, ITEM_ID);

      expect(prisma.referenceItem.delete).toHaveBeenCalledWith({
        where: { id: ITEM_ID, familyGroupId: FAMILY_GROUP_ID },
      });
    });

    it("refuses to delete a seeded system default (403), never calling delete", async () => {
      prisma.referenceItem.findUnique.mockResolvedValue({
        id: ITEM_ID,
        familyGroupId: FAMILY_GROUP_ID,
        isSystem: true,
      });

      await expect(
        service.remove(FAMILY_GROUP_ID, ITEM_ID),
      ).rejects.toMatchObject({ status: 403 });
      expect(prisma.referenceItem.delete).not.toHaveBeenCalled();
    });

    it("404s when the item does not exist in this family group (tenant-scoping denial)", async () => {
      prisma.referenceItem.findUnique.mockResolvedValue(null);

      await expect(
        service.remove(FAMILY_GROUP_ID, "nonexistent"),
      ).rejects.toMatchObject({ status: 404 });
      expect(prisma.referenceItem.delete).not.toHaveBeenCalled();
    });

    it("looks up scoped by both id AND familyGroupId, so another tenant's item id 404s instead of leaking existence", async () => {
      prisma.referenceItem.findUnique.mockResolvedValue(null);

      await service
        .remove(OTHER_FAMILY_GROUP_ID, ITEM_ID)
        .catch(() => undefined);

      expect(prisma.referenceItem.findUnique).toHaveBeenCalledWith({
        where: { id: ITEM_ID, familyGroupId: OTHER_FAMILY_GROUP_ID },
      });
    });
  });
});
