import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";

import { FamilyGroupsService } from "./family-groups.service";

const FAMILY_GROUP_ID = "fg-1";
const MEMBER_ID = "member-1";
const REQUESTER_ID = "user-owner";
const MEMBER_USER_ID = "user-member";

function makePrisma() {
  return {
    member: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
    account: { updateMany: jest.fn() },
    $transaction: jest.fn(async (ops: Array<Promise<unknown>>) =>
      Promise.all(ops),
    ),
  };
}

describe("FamilyGroupsService.removeMember", () => {
  let service: FamilyGroupsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FamilyGroupsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(FamilyGroupsService);
  });

  it("throws ForbiddenException when the requester is not an owner", async () => {
    prisma.member.findUnique.mockResolvedValue({ role: "member" });

    await expect(
      service.removeMember(FAMILY_GROUP_ID, MEMBER_ID, REQUESTER_ID),
    ).rejects.toThrow("Only owners can perform this action");
  });

  it("throws NotFoundException when the member does not exist in this family group", async () => {
    prisma.member.findUnique.mockResolvedValue({ role: "owner" });
    prisma.member.findFirst.mockResolvedValue(null);

    await expect(
      service.removeMember(FAMILY_GROUP_ID, MEMBER_ID, REQUESTER_ID),
    ).rejects.toThrow(NotFoundException);
  });

  it("rejects removing the last owner of a family group", async () => {
    prisma.member.findUnique.mockResolvedValue({ role: "owner" });
    prisma.member.findFirst.mockResolvedValue({
      id: MEMBER_ID,
      role: "owner",
      userId: REQUESTER_ID,
    });
    prisma.member.count.mockResolvedValue(1);

    await expect(
      service.removeMember(FAMILY_GROUP_ID, MEMBER_ID, REQUESTER_ID),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("EPIC-019 Task A — reverts any account owned by the removed member to family-shared, atomically with the removal", async () => {
    prisma.member.findUnique.mockResolvedValue({ role: "owner" });
    prisma.member.findFirst.mockResolvedValue({
      id: MEMBER_ID,
      role: "member",
      userId: MEMBER_USER_ID,
    });

    await service.removeMember(FAMILY_GROUP_ID, MEMBER_ID, REQUESTER_ID);

    expect(prisma.account.updateMany).toHaveBeenCalledWith({
      where: { familyGroupId: FAMILY_GROUP_ID, ownerUserId: MEMBER_USER_ID },
      data: { ownerUserId: null },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
