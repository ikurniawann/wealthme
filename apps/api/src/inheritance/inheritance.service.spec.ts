import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";

import { InheritanceService } from "./inheritance.service";

const FAMILY_GROUP_ID = "fg-1";
const ASSET_ID = "inh-asset-1";
const SOURCE_ASSET_ID = "asset-1";

const BASE_ROW = {
  id: ASSET_ID,
  familyGroupId: FAMILY_GROUP_ID,
  name: "Rumah Utama",
  assetType: "Aset / Properti",
  estimatedValue: BigInt(500_000_000),
  currency: "IDR",
  notes: null,
  visibility: "heirs_only",
  documentUrl: null,
  assetId: null,
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
  heirs: [] as unknown[],
};

function makePrisma() {
  return {
    inheritanceAsset: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    inheritanceHeir: {
      deleteMany: jest.fn(),
    },
    asset: {
      findUnique: jest.fn(),
    },
    member: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prismaTx)),
  };
}

// The service calls `this.prisma.$transaction(async (tx) => ...)` — supply a
// `tx` proxy that just delegates back to the same mocked delegates so the
// nested calls inside the callback are observable on the same mocks.
let prismaTx: {
  inheritanceAsset: { create: jest.Mock; update: jest.Mock };
  inheritanceHeir: { deleteMany: jest.Mock };
};

describe("InheritanceService", () => {
  let service: InheritanceService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    prismaTx = {
      inheritanceAsset: {
        create: prisma.inheritanceAsset.create,
        update: prisma.inheritanceAsset.update,
      },
      inheritanceHeir: { deleteMany: prisma.inheritanceHeir.deleteMany },
    };
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InheritanceService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<InheritanceService>(InheritanceService);
  });

  describe("create()", () => {
    it("allows creating an inheritance asset with zero heirs", async () => {
      // Arrange
      prisma.inheritanceAsset.create.mockResolvedValue({ ...BASE_ROW });

      // Act
      const result = await service.create(FAMILY_GROUP_ID, {
        name: "Rumah Utama",
        assetType: "Aset / Properti",
        estimatedValue: 500_000_000,
      });

      // Assert
      expect(result.heirs).toEqual([]);
      expect(prisma.asset.findUnique).not.toHaveBeenCalled();
    });

    it("accepts heirs whose percentages sum to exactly 100", async () => {
      // Arrange
      prisma.inheritanceAsset.create.mockResolvedValue({
        ...BASE_ROW,
        heirs: [],
      });

      // Act & Assert — should not throw
      await expect(
        service.create(FAMILY_GROUP_ID, {
          name: "Rumah Utama",
          assetType: "Aset / Properti",
          estimatedValue: 500_000_000,
          heirs: [
            { name: "Anak 1", relationship: "Anak", sharePercent: 60 },
            { name: "Anak 2", relationship: "Anak", sharePercent: 40 },
          ],
        }),
      ).resolves.toBeDefined();
    });

    it("accepts heirs whose percentages sum to less than 100 (partial allocation)", async () => {
      // Arrange
      prisma.inheritanceAsset.create.mockResolvedValue({
        ...BASE_ROW,
        heirs: [],
      });

      // Act & Assert — should not throw; remainder is "belum dialokasikan"
      await expect(
        service.create(FAMILY_GROUP_ID, {
          name: "Rumah Utama",
          assetType: "Aset / Properti",
          estimatedValue: 500_000_000,
          heirs: [{ name: "Anak 1", relationship: "Anak", sharePercent: 30 }],
        }),
      ).resolves.toBeDefined();
    });

    it("rejects heirs whose percentages sum to more than 100", async () => {
      // Act & Assert
      await expect(
        service.create(FAMILY_GROUP_ID, {
          name: "Rumah Utama",
          assetType: "Aset / Properti",
          estimatedValue: 500_000_000,
          heirs: [
            { name: "Anak 1", relationship: "Anak", sharePercent: 70 },
            { name: "Anak 2", relationship: "Anak", sharePercent: 50 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.inheritanceAsset.create).not.toHaveBeenCalled();
    });

    it("persists a heir's optional memberUserId link", async () => {
      // Arrange
      prisma.member.findFirst.mockResolvedValue({
        id: "member-1",
        userId: "user-5",
        familyGroupId: FAMILY_GROUP_ID,
      });
      prisma.inheritanceAsset.create.mockResolvedValue({
        ...BASE_ROW,
        heirs: [
          {
            id: "heir-1",
            inheritanceAssetId: ASSET_ID,
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
        name: "Rumah Utama",
        assetType: "Aset / Properti",
        estimatedValue: 500_000_000,
        heirs: [
          {
            name: "Anak 1",
            relationship: "Anak",
            sharePercent: 60,
            memberUserId: "user-5",
          },
        ],
      });

      // Assert
      expect(result.heirs[0]!.memberUserId).toBe("user-5");
      expect(prisma.member.findFirst).toHaveBeenCalledWith({
        where: { userId: "user-5", familyGroupId: FAMILY_GROUP_ID },
      });
      expect(prisma.inheritanceAsset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            heirs: {
              create: [
                expect.objectContaining({
                  memberUserId: "user-5",
                }),
              ],
            },
          }),
        }),
      );
    });

    // TS review fix #1 — memberUserId must be tenant-validated the same way
    // assetId is: a heir cannot link to a user from another family group.
    it("rejects a heir memberUserId that does not belong to the family group", async () => {
      // Arrange — member not found (cross-tenant or unknown user)
      prisma.member.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.create(FAMILY_GROUP_ID, {
          name: "Rumah Utama",
          assetType: "Aset / Properti",
          estimatedValue: 500_000_000,
          heirs: [
            {
              name: "Anak 1",
              relationship: "Anak",
              sharePercent: 60,
              memberUserId: "someone-elses-user-id",
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.inheritanceAsset.create).not.toHaveBeenCalled();
    });

    it("links to an existing asset in the same family group", async () => {
      // Arrange
      prisma.asset.findUnique.mockResolvedValue({
        id: SOURCE_ASSET_ID,
        familyGroupId: FAMILY_GROUP_ID,
      });
      prisma.inheritanceAsset.create.mockResolvedValue({
        ...BASE_ROW,
        assetId: SOURCE_ASSET_ID,
      });

      // Act
      const result = await service.create(FAMILY_GROUP_ID, {
        name: "Rumah Utama",
        assetType: "Aset / Properti",
        estimatedValue: 500_000_000,
        assetId: SOURCE_ASSET_ID,
      });

      // Assert
      expect(prisma.asset.findUnique).toHaveBeenCalledWith({
        where: { id: SOURCE_ASSET_ID, familyGroupId: FAMILY_GROUP_ID },
      });
      expect(result.assetId).toBe(SOURCE_ASSET_ID);
    });

    it("rejects an assetId that does not belong to the family group", async () => {
      // Arrange — asset belongs to a different tenant (or doesn't exist)
      prisma.asset.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.create(FAMILY_GROUP_ID, {
          name: "Rumah Utama",
          assetType: "Aset / Properti",
          estimatedValue: 500_000_000,
          assetId: "someone-elses-asset",
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.inheritanceAsset.create).not.toHaveBeenCalled();
    });
  });

  describe("update()", () => {
    it("rejects a heirs update whose percentages sum to more than 100", async () => {
      // Arrange
      prisma.inheritanceAsset.findUnique.mockResolvedValue({ ...BASE_ROW });

      // Act & Assert
      await expect(
        service.update(FAMILY_GROUP_ID, ASSET_ID, {
          heirs: [
            { name: "Anak 1", relationship: "Anak", sharePercent: 80 },
            { name: "Anak 2", relationship: "Anak", sharePercent: 30 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.inheritanceAsset.update).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the asset does not exist", async () => {
      // Arrange
      prisma.inheritanceAsset.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.update(FAMILY_GROUP_ID, "nonexistent-id", { name: "New" }),
      ).rejects.toThrow(NotFoundException);
    });

    // TS review fix #1 — same tenant validation applies on update.
    it("rejects a heir memberUserId that does not belong to the family group", async () => {
      // Arrange
      prisma.inheritanceAsset.findUnique.mockResolvedValue({ ...BASE_ROW });
      prisma.member.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.update(FAMILY_GROUP_ID, ASSET_ID, {
          heirs: [
            {
              name: "Anak 1",
              relationship: "Anak",
              sharePercent: 60,
              memberUserId: "cross-tenant-user",
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.inheritanceAsset.update).not.toHaveBeenCalled();
    });

    // TS review fix #2 — an explicit `null` assetId clears a previously
    // picked Asset link (e.g. switching back to manual entry).
    it("clears a previously linked assetId when the update sends assetId: null", async () => {
      // Arrange
      prisma.inheritanceAsset.findUnique.mockResolvedValue({
        ...BASE_ROW,
        assetId: SOURCE_ASSET_ID,
      });
      prisma.inheritanceAsset.update.mockResolvedValue({
        ...BASE_ROW,
        assetId: null,
      });

      // Act
      const result = await service.update(FAMILY_GROUP_ID, ASSET_ID, {
        assetId: null,
      });

      // Assert
      expect(prisma.asset.findUnique).not.toHaveBeenCalled();
      expect(prisma.inheritanceAsset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ assetId: null }),
        }),
      );
      expect(result.assetId).toBeNull();
    });
  });

  describe("remove()", () => {
    it("throws NotFoundException when the asset does not exist", async () => {
      // Arrange
      prisma.inheritanceAsset.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.remove(FAMILY_GROUP_ID, "nonexistent-id"),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.inheritanceAsset.delete).not.toHaveBeenCalled();
    });
  });
});
