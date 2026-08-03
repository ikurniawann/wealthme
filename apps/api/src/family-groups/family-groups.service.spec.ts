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
    },
    account: { updateMany: jest.fn() },
    familyGroup: { findUnique: jest.fn() },
    invitation: { create: jest.fn() },
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
