import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";

import { MemberCategoryAllowancesService } from "./member-category-allowances.service";

const FAMILY_GROUP_ID = "fg-1";
const MEMBER_ID = "member-1";
const CATEGORY_A = "cat-a";
const CATEGORY_B = "cat-b";

function makePrisma() {
  return {
    member: { findFirst: jest.fn() },
    category: { count: jest.fn() },
    memberCategoryAllowance: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn(async (ops: Array<Promise<unknown>>) =>
      Promise.all(ops),
    ),
  };
}

describe("MemberCategoryAllowancesService", () => {
  let service: MemberCategoryAllowancesService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemberCategoryAllowancesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(MemberCategoryAllowancesService);
  });

  describe("findAll", () => {
    it("throws NotFoundException when the member does not belong to this family group", async () => {
      prisma.member.findFirst.mockResolvedValue(null);

      await expect(service.findAll(FAMILY_GROUP_ID, MEMBER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("returns an empty list for an unrestricted member", async () => {
      prisma.member.findFirst.mockResolvedValue({ id: MEMBER_ID });
      prisma.memberCategoryAllowance.findMany.mockResolvedValue([]);

      const result = await service.findAll(FAMILY_GROUP_ID, MEMBER_ID);

      expect(result).toEqual({ memberId: MEMBER_ID, categories: [] });
    });

    it("returns the allowed categories for a constrained member", async () => {
      prisma.member.findFirst.mockResolvedValue({ id: MEMBER_ID });
      prisma.memberCategoryAllowance.findMany.mockResolvedValue([
        { category: { id: CATEGORY_A, name: "Belanja" } },
      ]);

      const result = await service.findAll(FAMILY_GROUP_ID, MEMBER_ID);

      expect(result.categories).toEqual([{ id: CATEGORY_A, name: "Belanja" }]);
    });
  });

  describe("replace", () => {
    it("throws NotFoundException when the member does not belong to this family group", async () => {
      prisma.member.findFirst.mockResolvedValue(null);

      await expect(
        service.replace(FAMILY_GROUP_ID, MEMBER_ID, {
          categoryIds: [CATEGORY_A],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("rejects a categoryId that is not a valid expense category in this family group", async () => {
      prisma.member.findFirst.mockResolvedValue({ id: MEMBER_ID });
      prisma.category.count.mockResolvedValue(0);

      await expect(
        service.replace(FAMILY_GROUP_ID, MEMBER_ID, {
          categoryIds: ["cat-cross-tenant"],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.memberCategoryAllowance.deleteMany).not.toHaveBeenCalled();
    });

    it("replaces the allow-list with the given valid category ids", async () => {
      prisma.member.findFirst.mockResolvedValue({ id: MEMBER_ID });
      prisma.category.count.mockResolvedValue(2);
      prisma.memberCategoryAllowance.findMany.mockResolvedValue([
        { category: { id: CATEGORY_A, name: "Belanja" } },
        { category: { id: CATEGORY_B, name: "Transport" } },
      ]);

      const result = await service.replace(FAMILY_GROUP_ID, MEMBER_ID, {
        categoryIds: [CATEGORY_A, CATEGORY_B],
      });

      expect(prisma.memberCategoryAllowance.deleteMany).toHaveBeenCalledWith({
        where: { memberId: MEMBER_ID },
      });
      expect(prisma.memberCategoryAllowance.createMany).toHaveBeenCalledWith({
        data: [
          { memberId: MEMBER_ID, categoryId: CATEGORY_A },
          { memberId: MEMBER_ID, categoryId: CATEGORY_B },
        ],
      });
      expect(result.categories).toHaveLength(2);
    });

    it("clears the allow-list back to unrestricted with an empty array", async () => {
      prisma.member.findFirst.mockResolvedValue({ id: MEMBER_ID });
      prisma.memberCategoryAllowance.findMany.mockResolvedValue([]);

      const result = await service.replace(FAMILY_GROUP_ID, MEMBER_ID, {
        categoryIds: [],
      });

      expect(prisma.category.count).not.toHaveBeenCalled();
      expect(prisma.memberCategoryAllowance.deleteMany).toHaveBeenCalledWith({
        where: { memberId: MEMBER_ID },
      });
      expect(prisma.memberCategoryAllowance.createMany).not.toHaveBeenCalled();
      expect(result.categories).toEqual([]);
    });
  });
});
