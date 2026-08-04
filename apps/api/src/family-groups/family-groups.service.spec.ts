import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";
import { Role } from "@prisma/client";

import { NOTIFICATION_SENDER_PORT } from "../notifications/notification-sender.port";
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
      update: jest.fn(),
      create: jest.fn(),
    },
    account: { updateMany: jest.fn() },
    familyGroup: { findUnique: jest.fn(), update: jest.fn() },
    invitation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
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
        {
          provide: NOTIFICATION_SENDER_PORT,
          useValue: { sendEmail: jest.fn() },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
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

const OWNER_ID = "user-owner";

/** Flush the microtask queue so a fire-and-forget `void` call has settled. */
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe("FamilyGroupsService.createInvitation — invitation email (QA-sweep #4)", () => {
  let service: FamilyGroupsService;
  let prisma: ReturnType<typeof makePrisma>;
  let sender: { sendEmail: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(async () => {
    prisma = makePrisma();
    sender = { sendEmail: jest.fn().mockResolvedValue(undefined) };
    config = { get: jest.fn(() => "http://localhost:3000") };

    prisma.member.findUnique.mockResolvedValue({ role: Role.owner });
    prisma.familyGroup.findUnique.mockResolvedValue({
      name: "Keluarga Arsandi",
    });
    prisma.invitation.create.mockResolvedValue({
      id: "inv-1",
      token: "tok-123",
      familyGroupId: FAMILY_GROUP_ID,
      email: "invitee@example.com",
      role: Role.member,
      expiresAt: new Date("2026-01-08T00:00:00.000Z"),
      usedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FamilyGroupsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NOTIFICATION_SENDER_PORT, useValue: sender },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = module.get(FamilyGroupsService);
  });

  it("sends an invitation email with a join link built from WEB_ORIGIN", async () => {
    await service.createInvitation(FAMILY_GROUP_ID, OWNER_ID, {
      email: "invitee@example.com",
    });
    await flushMicrotasks();

    expect(sender.sendEmail).toHaveBeenCalledTimes(1);
    const [to, toName, subject, body] = sender.sendEmail.mock
      .calls[0] as string[];
    expect(to).toBe("invitee@example.com");
    expect(toName).toBe("invitee@example.com");
    expect(subject).toContain("Keluarga Arsandi");
    expect(body).toContain("http://localhost:3000/join/tok-123");
  });

  it("does not fail invitation creation when the email send rejects", async () => {
    sender.sendEmail.mockRejectedValue(new Error("SendGrid down"));

    const result = await service.createInvitation(FAMILY_GROUP_ID, OWNER_ID, {
      email: "invitee@example.com",
    });

    expect(result.token).toBe("tok-123");
    await flushMicrotasks();
    expect(sender.sendEmail).toHaveBeenCalledTimes(1);
  });
});

// EPIC-021 Group F (#6) — user-maintained gold price per gram, owner-only
// write, no live feed. Open Design Decision #6.
describe("FamilyGroupsService gold price", () => {
  let service: FamilyGroupsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FamilyGroupsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NOTIFICATION_SENDER_PORT,
          useValue: { sendEmail: jest.fn() },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();
    service = module.get(FamilyGroupsService);
  });

  describe("getGoldPrice", () => {
    it("throws ForbiddenException when the requester is not a member", async () => {
      prisma.member.findUnique.mockResolvedValue(null);

      await expect(
        service.getGoldPrice(FAMILY_GROUP_ID, REQUESTER_ID),
      ).rejects.toThrow("Not a member of this family group");
    });

    it("returns null pricePerGram/updatedAt when no price has been set (null path)", async () => {
      prisma.member.findUnique.mockResolvedValue({ role: "member" });
      prisma.familyGroup.findUnique.mockResolvedValue({
        goldPricePerGram: null,
        goldPriceUpdatedAt: null,
      });

      const result = await service.getGoldPrice(
        FAMILY_GROUP_ID,
        MEMBER_USER_ID,
      );

      expect(result).toEqual({ pricePerGram: null, updatedAt: null });
    });

    it("serializes a set price as a string with an ISO updatedAt", async () => {
      prisma.member.findUnique.mockResolvedValue({ role: "member" });
      prisma.familyGroup.findUnique.mockResolvedValue({
        goldPricePerGram: 1150000n,
        goldPriceUpdatedAt: new Date("2026-08-04T00:00:00.000Z"),
      });

      const result = await service.getGoldPrice(
        FAMILY_GROUP_ID,
        MEMBER_USER_ID,
      );

      expect(result).toEqual({
        pricePerGram: "1150000",
        updatedAt: "2026-08-04T00:00:00.000Z",
      });
    });

    it("throws NotFoundException when the family group does not exist", async () => {
      prisma.member.findUnique.mockResolvedValue({ role: "member" });
      prisma.familyGroup.findUnique.mockResolvedValue(null);

      await expect(
        service.getGoldPrice(FAMILY_GROUP_ID, MEMBER_USER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateGoldPrice", () => {
    it("throws ForbiddenException when the requester is not an owner", async () => {
      prisma.member.findUnique.mockResolvedValue({ role: "member" });

      await expect(
        service.updateGoldPrice(FAMILY_GROUP_ID, MEMBER_USER_ID, {
          pricePerGram: 1150000,
        }),
      ).rejects.toThrow("Only owners can perform this action");
      expect(prisma.familyGroup.update).not.toHaveBeenCalled();
    });

    it("owner: persists the price as BigInt and stamps goldPriceUpdatedAt", async () => {
      prisma.member.findUnique.mockResolvedValue({ role: "owner" });
      prisma.familyGroup.update.mockResolvedValue({
        goldPricePerGram: 1150000n,
        goldPriceUpdatedAt: new Date("2026-08-04T00:00:00.000Z"),
      });

      const result = await service.updateGoldPrice(FAMILY_GROUP_ID, OWNER_ID, {
        pricePerGram: 1150000,
      });

      expect(prisma.familyGroup.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: FAMILY_GROUP_ID },
          data: expect.objectContaining({ goldPricePerGram: 1150000n }),
        }),
      );
      expect(result.pricePerGram).toBe("1150000");
      expect(result.updatedAt).toBe("2026-08-04T00:00:00.000Z");
    });
  });
});

// EPIC-023 Task C (D1, US-FAM-8/9) — two axes: relationship is descriptive,
// role carries permission. The owner may set/clear either independently and
// pair ANY relationship with ANY role — kinship never constrains authority.
describe("FamilyGroupsService.updateMemberRole — relationship (EPIC-023 Task C)", () => {
  let service: FamilyGroupsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    prisma.member.findUnique.mockResolvedValue({ role: Role.owner });
    prisma.member.findFirst.mockResolvedValue({
      id: MEMBER_ID,
      role: Role.member,
      userId: MEMBER_USER_ID,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FamilyGroupsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NOTIFICATION_SENDER_PORT,
          useValue: { sendEmail: jest.fn() },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();
    service = module.get(FamilyGroupsService);
  });

  it("assigns the new spouse/dependant/operational roles and pairs a relationship the mapping would not have defaulted (any pair is valid)", async () => {
    prisma.member.update.mockResolvedValue({
      id: MEMBER_ID,
      userId: MEMBER_USER_ID,
      familyGroupId: FAMILY_GROUP_ID,
      role: Role.operational,
      relationship: "kakek",
      user: { name: "Kakek", email: "kakek@example.com" },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const result = await service.updateMemberRole(
      FAMILY_GROUP_ID,
      MEMBER_ID,
      REQUESTER_ID,
      { role: Role.operational, relationship: "kakek" },
    );

    expect(prisma.member.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: MEMBER_ID },
        data: { role: Role.operational, relationship: "kakek" },
      }),
    );
    expect(result.role).toBe(Role.operational);
    expect(result.relationship).toBe("kakek");
  });

  it("omitting relationship leaves it unchanged (undefined is dropped from the update payload)", async () => {
    prisma.member.update.mockResolvedValue({
      id: MEMBER_ID,
      userId: MEMBER_USER_ID,
      familyGroupId: FAMILY_GROUP_ID,
      role: Role.spouse,
      relationship: null,
      user: { name: "Pasangan", email: "pasangan@example.com" },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await service.updateMemberRole(FAMILY_GROUP_ID, MEMBER_ID, REQUESTER_ID, {
      role: Role.spouse,
    });

    expect(prisma.member.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: MEMBER_ID },
        data: { role: Role.spouse },
      }),
    );
  });
});

describe("FamilyGroupsService.acceptInvitation — relationship carried through (EPIC-023 Task C)", () => {
  let service: FamilyGroupsService;
  let prisma: ReturnType<typeof makePrisma>;

  const TOKEN = "tok-relationship";
  const ACCEPTING_USER_ID = "user-accepting";

  beforeEach(async () => {
    prisma = makePrisma();
    prisma.invitation.findUnique.mockResolvedValue({
      token: TOKEN,
      familyGroupId: FAMILY_GROUP_ID,
      role: Role.spouse,
      relationship: "istri",
      expiresAt: new Date(Date.now() + 86_400_000),
      usedAt: null,
      familyGroup: { name: "Keluarga Arsandi" },
    });
    prisma.member.findUnique.mockResolvedValue(null);
    prisma.member.create.mockResolvedValue({
      id: "member-new",
      userId: ACCEPTING_USER_ID,
      familyGroupId: FAMILY_GROUP_ID,
      role: Role.spouse,
      relationship: "istri",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      user: { name: "Istri", email: "istri@example.com" },
    });
    prisma.invitation.update.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FamilyGroupsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NOTIFICATION_SENDER_PORT,
          useValue: { sendEmail: jest.fn() },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();
    service = module.get(FamilyGroupsService);
  });

  it("carries the invitation's relationship onto the created Member row", async () => {
    const result = await service.acceptInvitation(TOKEN, ACCEPTING_USER_ID);

    expect(prisma.member.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: Role.spouse,
          relationship: "istri",
        }),
      }),
    );
    expect(result.relationship).toBe("istri");
  });
});
