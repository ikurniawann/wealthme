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
      findMany: jest.fn().mockResolvedValue([]),
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
      // EPIC-023 Group F fix round (MEDIUM 8) — resolveMemberLookup's own
      // query (member.findMany) must ALSO resolve this member for the
      // link to read as live; in production it does (the same member
      // `assertMemberInFamilyGroup` above just confirmed exists).
      prisma.member.findMany.mockResolvedValue([
        { userId: "user-5", relationship: "anak", user: { name: "Anak 1" } },
      ]);
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

  // EPIC-023 F1 (D14, US-INS-5) — a heir linked to a family member resolves
  // its displayed name/relationship from the member's CURRENT record, not
  // the copy stored on the heir row. Fails against pre-F1 code, which
  // always echoed the stored name/relationship.
  describe("live-linked heirs (F1)", () => {
    it("findOne() resolves name/relationship from the CURRENT member record, overriding the stored copy", async () => {
      // Arrange — stored row still says "Anak 1" / "Anak" (stale), but the
      // member's live name/relationship have since changed.
      prisma.inheritanceAsset.findUnique.mockResolvedValue({
        ...BASE_ROW,
        heirs: [
          {
            id: "heir-1",
            inheritanceAssetId: ASSET_ID,
            name: "Anak 1 (stale)",
            relationship: "Anak (stale)",
            sharePercent: { toString: () => "60.00" },
            memberUserId: "user-5",
            createdAt: new Date("2024-01-01T00:00:00.000Z"),
          },
        ],
      });
      prisma.member.findMany.mockResolvedValue([
        { userId: "user-5", relationship: "anak", user: { name: "Budi Baru" } },
      ]);

      // Act
      const result = await service.findOne(FAMILY_GROUP_ID, ASSET_ID);

      // Assert
      expect(result.heirs[0]!.name).toBe("Budi Baru");
      expect(result.heirs[0]!.relationship).toBe("anak");
      expect(prisma.member.findMany).toHaveBeenCalledWith({
        where: { familyGroupId: FAMILY_GROUP_ID, userId: { in: ["user-5"] } },
        include: { user: { select: { name: true } } },
      });
    });

    it("findOne() keeps the free-text name/relationship for a non-member heir", async () => {
      // Arrange
      prisma.inheritanceAsset.findUnique.mockResolvedValue({
        ...BASE_ROW,
        heirs: [
          {
            id: "heir-1",
            inheritanceAssetId: ASSET_ID,
            name: "Bibi Jauh",
            relationship: "Kerabat",
            sharePercent: { toString: () => "40.00" },
            memberUserId: null,
            createdAt: new Date("2024-01-01T00:00:00.000Z"),
          },
        ],
      });

      // Act
      const result = await service.findOne(FAMILY_GROUP_ID, ASSET_ID);

      // Assert — no member lookup query at all for an unlinked heir.
      expect(result.heirs[0]!.name).toBe("Bibi Jauh");
      expect(result.heirs[0]!.relationship).toBe("Kerabat");
      expect(prisma.member.findMany).not.toHaveBeenCalled();
    });

    // Revisi K — the owner (Master) can have a null `Member.relationship`
    // (it's purely descriptive kinship, not required). A linked heir must
    // still show the relationship typed at creation time (e.g. "Diri
    // sendiri"), not fall through to null/empty just because the member's
    // current record has none.
    it("findOne() falls back to the stored relationship when the linked member's CURRENT relationship is null (e.g. the owner)", async () => {
      prisma.inheritanceAsset.findUnique.mockResolvedValue({
        ...BASE_ROW,
        heirs: [
          {
            id: "heir-1",
            inheritanceAssetId: ASSET_ID,
            name: "Budi (Master)",
            relationship: "Diri sendiri",
            sharePercent: { toString: () => "100.00" },
            memberUserId: "user-owner",
            createdAt: new Date("2024-01-01T00:00:00.000Z"),
          },
        ],
      });
      prisma.member.findMany.mockResolvedValue([
        {
          userId: "user-owner",
          relationship: null,
          user: { name: "Budi (Master)" },
        },
      ]);

      const result = await service.findOne(FAMILY_GROUP_ID, ASSET_ID);

      expect(result.heirs[0]!.name).toBe("Budi (Master)");
      expect(result.heirs[0]!.relationship).toBe("Diri sendiri");
    });

    // EPIC-023 Group F fix round (MEDIUM 8) — a heir whose linked member
    // was removed from the family must not keep reading as a live link:
    // `memberUserId` is nulled out, and the last-known copy is shown.
    it("findOne() nulls memberUserId when the linked member no longer resolves (orphaned link)", async () => {
      prisma.inheritanceAsset.findUnique.mockResolvedValue({
        ...BASE_ROW,
        heirs: [
          {
            id: "heir-1",
            inheritanceAssetId: ASSET_ID,
            name: "Anak 1 (last known)",
            relationship: "Anak (last known)",
            sharePercent: { toString: () => "60.00" },
            memberUserId: "user-removed",
            createdAt: new Date("2024-01-01T00:00:00.000Z"),
          },
        ],
      });
      // The member was removed — resolveMemberLookup's query finds nothing.
      prisma.member.findMany.mockResolvedValue([]);

      const result = await service.findOne(FAMILY_GROUP_ID, ASSET_ID);

      expect(result.heirs[0]!.memberUserId).toBeNull();
      expect(result.heirs[0]!.name).toBe("Anak 1 (last known)");
      expect(result.heirs[0]!.relationship).toBe("Anak (last known)");
    });
  });
});
