import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";
import { MemberRelationship, Prisma, Role } from "@prisma/client";
import * as argon2 from "argon2";

import { NOTIFICATION_SENDER_PORT } from "../notifications/notification-sender.port";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";

import { FamilyGroupsService } from "./family-groups.service";

const FAMILY_GROUP_ID = "fg-1";
const MEMBER_ID = "member-1";
const REQUESTER_ID = "user-owner";
const MEMBER_USER_ID = "user-member";

function makeRedis() {
  return { del: jest.fn(), get: jest.fn(), set: jest.fn() };
}

function makePrisma() {
  const prisma = {
    member: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    account: { updateMany: jest.fn() },
    // EPIC-027 A9 — removal revokes better-auth sessions.
    baSession: { deleteMany: jest.fn() },
    baAccount: { updateMany: jest.fn() },
    user: { update: jest.fn() },
    familyGroup: { findUnique: jest.fn(), update: jest.fn() },
    invitation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $queryRaw: jest.fn().mockResolvedValue(undefined),
    // Supports BOTH call shapes used across this service: the array form
    // (`$transaction([...])` -> Promise.all) AND the interactive callback
    // form (`$transaction(async (tx) => ...)` -> invoke with this same
    // mock object standing in for `tx`, since every mocked model method
    // lives directly on `prisma` here).
    $transaction: jest.fn(
      async (
        arg: Array<Promise<unknown>> | ((tx: unknown) => Promise<unknown>),
      ) => (typeof arg === "function" ? arg(prisma) : Promise.all(arg)),
    ),
  };
  return prisma;
}

describe("FamilyGroupsService.removeMember", () => {
  let service: FamilyGroupsService;
  let prisma: ReturnType<typeof makePrisma>;
  let redis: ReturnType<typeof makeRedis>;

  beforeEach(async () => {
    prisma = makePrisma();
    redis = makeRedis();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FamilyGroupsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NOTIFICATION_SENDER_PORT,
          useValue: { sendEmail: jest.fn() },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: RedisService, useValue: redis },
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

  // EPIC-027 A7 (D4) — the removal used to be `member.delete`, which left the
  // User row and its credential behind: the removed member kept signing in,
  // and with no membership left the web shell treated them as trusted. These
  // assertions are the regression guard for that.
  it("EPIC-027 A7 — soft-deletes the member instead of destroying the row", async () => {
    prisma.member.findUnique.mockResolvedValue({ role: "owner" });
    prisma.member.findFirst.mockResolvedValue({
      id: MEMBER_ID,
      role: "dependant",
      userId: MEMBER_USER_ID,
    });

    await service.removeMember(FAMILY_GROUP_ID, MEMBER_ID, REQUESTER_ID);

    expect(prisma.member.delete).not.toHaveBeenCalled();
    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: MEMBER_ID },
      data: { deletedAt: expect.any(Date) },
    });
  });

  // EPIC-027 A9 (D7) — soft-deleting the membership only stops the NEXT
  // request from resolving a family group; a token already in hand keeps
  // working until it expires. Removal must tear the credentials down.
  it("EPIC-027 A9 — revokes the removed member's refresh key and sessions", async () => {
    prisma.member.findUnique.mockResolvedValue({ role: "owner" });
    prisma.member.findFirst.mockResolvedValue({
      id: MEMBER_ID,
      role: "dependant",
      userId: MEMBER_USER_ID,
    });

    await service.removeMember(FAMILY_GROUP_ID, MEMBER_ID, REQUESTER_ID);

    expect(redis.del).toHaveBeenCalledWith(`refresh:${MEMBER_USER_ID}`);
    expect(prisma.baSession.deleteMany).toHaveBeenCalledWith({
      where: { userId: MEMBER_USER_ID },
    });
  });

  it("EPIC-027 A9 — a revocation failure does not undo or fail the removal", async () => {
    prisma.member.findUnique.mockResolvedValue({ role: "owner" });
    prisma.member.findFirst.mockResolvedValue({
      id: MEMBER_ID,
      role: "dependant",
      userId: MEMBER_USER_ID,
    });
    redis.del.mockRejectedValue(new Error("redis down"));

    await expect(
      service.removeMember(FAMILY_GROUP_ID, MEMBER_ID, REQUESTER_ID),
    ).resolves.toBeUndefined();
    expect(prisma.member.update).toHaveBeenCalled();
  });
});

describe("FamilyGroupsService — removed members (EPIC-027 A8)", () => {
  let service: FamilyGroupsService;
  let prisma: ReturnType<typeof makePrisma> & {
    member: ReturnType<typeof makePrisma>["member"] & { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      ...makePrisma(),
      member: { ...makePrisma().member, findMany: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FamilyGroupsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NOTIFICATION_SENDER_PORT,
          useValue: { sendEmail: jest.fn() },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: RedisService, useValue: makeRedis() },
      ],
    }).compile();
    service = module.get(FamilyGroupsService);
  });

  it("restores a removed member by clearing deletedAt", async () => {
    prisma.member.findUnique.mockResolvedValue({ role: "owner" });
    prisma.member.findFirst.mockResolvedValue({ id: MEMBER_ID });

    await service.restoreMember(FAMILY_GROUP_ID, MEMBER_ID, REQUESTER_ID);

    // The soft-delete extension hides removed rows from every read, so the
    // lookup MUST opt out explicitly or it can never find its own target.
    expect(prisma.member.findFirst).toHaveBeenCalledWith({
      where: {
        id: MEMBER_ID,
        familyGroupId: FAMILY_GROUP_ID,
        deletedAt: { not: null },
      },
    });
    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: MEMBER_ID },
      data: { deletedAt: null },
    });
  });

  it("refuses to restore a member that was never removed", async () => {
    prisma.member.findUnique.mockResolvedValue({ role: "owner" });
    prisma.member.findFirst.mockResolvedValue(null);

    await expect(
      service.restoreMember(FAMILY_GROUP_ID, MEMBER_ID, REQUESTER_ID),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.member.update).not.toHaveBeenCalled();
  });

  it("refuses to restore for a non-owner", async () => {
    prisma.member.findUnique.mockResolvedValue({ role: "member" });

    await expect(
      service.restoreMember(FAMILY_GROUP_ID, MEMBER_ID, REQUESTER_ID),
    ).rejects.toThrow("Only owners can perform this action");
  });

  it("lists only removed members", async () => {
    prisma.member.findUnique.mockResolvedValue({ role: "owner" });
    prisma.member.findMany.mockResolvedValue([
      {
        id: MEMBER_ID,
        userId: MEMBER_USER_ID,
        familyGroupId: FAMILY_GROUP_ID,
        role: Role.dependant,
        relationship: MemberRelationship.anak,
        largeTxnThreshold: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        user: { name: "Aisyah", email: "member-x@members.invalid" },
      },
    ]);

    const result = await service.listRemovedMembers(
      FAMILY_GROUP_ID,
      REQUESTER_ID,
    );

    expect(prisma.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { familyGroupId: FAMILY_GROUP_ID, deletedAt: { not: null } },
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Aisyah");
  });

  it("refuses to list removed members for a non-owner", async () => {
    prisma.member.findUnique.mockResolvedValue({ role: "dependant" });

    await expect(
      service.listRemovedMembers(FAMILY_GROUP_ID, REQUESTER_ID),
    ).rejects.toThrow("Only owners can perform this action");
  });
});

// EPIC-024 A3 (Evidence #1) — this is the reference implementation the
// other two group-resolution paths (apps/web/src/lib/auth.ts's session
// hook, apps/api/src/auth/auth.service.ts's getMe/getProfileDetail/
// updateProfile) were unified to match: `createdAt: "asc"` (oldest
// membership first).
describe("FamilyGroupsService.findMine (EPIC-024 A3)", () => {
  let service: FamilyGroupsService;
  let prisma: ReturnType<typeof makePrisma> & {
    member: ReturnType<typeof makePrisma>["member"] & { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      ...makePrisma(),
      member: { ...makePrisma().member, findMany: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FamilyGroupsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NOTIFICATION_SENDER_PORT,
          useValue: { sendEmail: jest.fn() },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: RedisService, useValue: makeRedis() },
      ],
    }).compile();
    service = module.get(FamilyGroupsService);
  });

  it("queries with orderBy createdAt asc — the deterministic 'oldest wins' rule", async () => {
    prisma.member.findMany.mockResolvedValue([]);
    await service.findMine("user-1");

    expect(prisma.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "asc" } }),
    );
  });

  it("a user with two memberships resolves the OLDEST group first — same fixture auth.service.ts's getMe() must agree with", async () => {
    // Simulates the reported bug's exact fixture: a wife's own
    // auto-created group (created first, at her own registration) plus a
    // later membership in her husband's group (added/invited afterward).
    prisma.member.findMany.mockResolvedValue([
      {
        familyGroup: {
          id: "fg-own-empty",
          name: "Sari's Family",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          _count: { members: 1 },
        },
        role: "owner",
      },
      {
        familyGroup: {
          id: "fg-husband",
          name: "Budi's Family",
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
          _count: { members: 3 },
        },
        role: "owner",
      },
    ]);

    const result = await service.findMine("user-wife");

    expect(result[0]?.id).toBe("fg-own-empty");
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
        { provide: RedisService, useValue: makeRedis() },
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
        { provide: RedisService, useValue: makeRedis() },
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

// EPIC-023 F2 (D20, US-DON-6/7) — family religion setting, same
// owner-writable/member-readable shape as gold price above.
describe("FamilyGroupsService religion", () => {
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
        { provide: RedisService, useValue: makeRedis() },
      ],
    }).compile();
    service = module.get(FamilyGroupsService);
  });

  describe("getReligion", () => {
    it("throws ForbiddenException when the requester is not a member", async () => {
      prisma.member.findUnique.mockResolvedValue(null);

      await expect(
        service.getReligion(FAMILY_GROUP_ID, REQUESTER_ID),
      ).rejects.toThrow("Not a member of this family group");
    });

    it("returns the family's religion setting", async () => {
      prisma.member.findUnique.mockResolvedValue({ role: "member" });
      prisma.familyGroup.findUnique.mockResolvedValue({ religion: "kristen" });

      const result = await service.getReligion(FAMILY_GROUP_ID, MEMBER_USER_ID);

      expect(result).toEqual({ religion: "kristen" });
    });

    it("throws NotFoundException when the family group does not exist", async () => {
      prisma.member.findUnique.mockResolvedValue({ role: "member" });
      prisma.familyGroup.findUnique.mockResolvedValue(null);

      await expect(
        service.getReligion(FAMILY_GROUP_ID, MEMBER_USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    // EPIC-023 Group F fix round (MEDIUM 9) — `null` is the honest
    // "not yet chosen" state (see the migration backfilling every
    // pre-existing family off the fabricated `islam` default), not an
    // error — the response passes it straight through.
    it("returns null for a family that has not yet chosen a religion", async () => {
      prisma.member.findUnique.mockResolvedValue({ role: "member" });
      prisma.familyGroup.findUnique.mockResolvedValue({ religion: null });

      const result = await service.getReligion(FAMILY_GROUP_ID, MEMBER_USER_ID);

      expect(result).toEqual({ religion: null });
    });
  });

  describe("updateReligion", () => {
    it("throws ForbiddenException when the requester is not an owner", async () => {
      prisma.member.findUnique.mockResolvedValue({ role: "member" });

      await expect(
        service.updateReligion(FAMILY_GROUP_ID, MEMBER_USER_ID, {
          religion: "kristen",
        }),
      ).rejects.toThrow("Only owners can perform this action");
      expect(prisma.familyGroup.update).not.toHaveBeenCalled();
    });

    it("owner: persists the new religion setting", async () => {
      prisma.member.findUnique.mockResolvedValue({ role: "owner" });
      prisma.familyGroup.update.mockResolvedValue({ religion: "kristen" });

      const result = await service.updateReligion(FAMILY_GROUP_ID, OWNER_ID, {
        religion: "kristen",
      });

      expect(prisma.familyGroup.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: FAMILY_GROUP_ID },
          data: { religion: "kristen" },
        }),
      );
      expect(result).toEqual({ religion: "kristen" });
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
        { provide: RedisService, useValue: makeRedis() },
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

// Review-fix (database-reviewer + adversarial-reviewer, EPIC-024 Group A) —
// `createDependantMember` enforces max-1-istri per family group, but
// `updateMemberRole` could bypass it by re-labeling an EXISTING member's
// `relationship` to "istri" with no lock and no check at all. `role: owner`
// is already excluded from `ASSIGNABLE_ROLES` so this path cannot mint a
// second co-master via role, but it could still produce two
// `relationship: istri` rows in the same family group. These tests prove
// the same lock-then-recheck guard now also covers this path.
describe("FamilyGroupsService.updateMemberRole — max-1-istri guard (review-fix)", () => {
  let service: FamilyGroupsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    prisma.member.findUnique.mockResolvedValue({ role: Role.owner });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FamilyGroupsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NOTIFICATION_SENDER_PORT,
          useValue: { sendEmail: jest.fn() },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: RedisService, useValue: makeRedis() },
      ],
    }).compile();
    service = module.get(FamilyGroupsService);
  });

  it("refuses to set relationship: istri on a member when the family group already has a DIFFERENT istri", async () => {
    prisma.member.findFirst
      .mockResolvedValueOnce({
        id: MEMBER_ID,
        role: Role.member,
        relationship: null,
        userId: MEMBER_USER_ID,
      })
      // The recheck (excluding the target member itself) finds the
      // family's existing co-master.
      .mockResolvedValueOnce({ id: "existing-istri-member" });

    try {
      await service.updateMemberRole(FAMILY_GROUP_ID, MEMBER_ID, REQUESTER_ID, {
        role: Role.spouse,
        relationship: MemberRelationship.istri,
      });
      throw new Error("expected updateMemberRole to reject");
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual(
        expect.objectContaining({ code: "MAX_ONE_ISTRI" }),
      );
    }
    expect(prisma.member.update).not.toHaveBeenCalled();
    // Locks the family group row before the recheck, same as
    // createDependantMember's istri path.
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it("allows setting relationship: istri when no other member currently has it", async () => {
    prisma.member.findFirst
      .mockResolvedValueOnce({
        id: MEMBER_ID,
        role: Role.member,
        relationship: null,
        userId: MEMBER_USER_ID,
      })
      .mockResolvedValueOnce(null); // recheck: no existing istri elsewhere

    prisma.member.update.mockResolvedValue({
      id: MEMBER_ID,
      userId: MEMBER_USER_ID,
      familyGroupId: FAMILY_GROUP_ID,
      role: Role.spouse,
      relationship: "istri",
      user: { name: "Sari", email: "sari@example.com" },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const result = await service.updateMemberRole(
      FAMILY_GROUP_ID,
      MEMBER_ID,
      REQUESTER_ID,
      { role: Role.spouse, relationship: MemberRelationship.istri },
    );

    expect(result.relationship).toBe("istri");
    expect(prisma.member.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: MEMBER_ID },
        data: { role: Role.spouse, relationship: "istri" },
      }),
    );
  });

  it("does not run the istri max-1 recheck when the target member ALREADY has relationship: istri (no false self-conflict)", async () => {
    prisma.member.findFirst.mockResolvedValueOnce({
      id: MEMBER_ID,
      role: Role.owner,
      relationship: "istri",
      userId: MEMBER_USER_ID,
    });
    prisma.member.update.mockResolvedValue({
      id: MEMBER_ID,
      userId: MEMBER_USER_ID,
      familyGroupId: FAMILY_GROUP_ID,
      role: Role.owner,
      relationship: "istri",
      user: { name: "Sari", email: "sari@example.com" },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await service.updateMemberRole(FAMILY_GROUP_ID, MEMBER_ID, REQUESTER_ID, {
      role: Role.owner,
      relationship: MemberRelationship.istri,
    });

    // Only the initial existence lookup — never a second `findFirst` recheck.
    expect(prisma.member.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
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
        { provide: RedisService, useValue: makeRedis() },
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

describe("FamilyGroupsService.updateMemberRole — largeTxnThreshold (EPIC-023 Task D, D3/D9)", () => {
  let service: FamilyGroupsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    prisma.member.findUnique.mockResolvedValue({ role: Role.owner });
    prisma.member.findFirst.mockResolvedValue({
      id: MEMBER_ID,
      role: Role.operational,
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
        { provide: RedisService, useValue: makeRedis() },
      ],
    }).compile();
    service = module.get(FamilyGroupsService);
  });

  it("persists a positive threshold as BigInt and returns it as a string", async () => {
    prisma.member.update.mockResolvedValue({
      id: MEMBER_ID,
      userId: MEMBER_USER_ID,
      familyGroupId: FAMILY_GROUP_ID,
      role: Role.operational,
      relationship: null,
      largeTxnThreshold: BigInt(500000),
      user: { name: "Supir", email: "supir@example.com" },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const result = await service.updateMemberRole(
      FAMILY_GROUP_ID,
      MEMBER_ID,
      REQUESTER_ID,
      { role: Role.operational, largeTxnThreshold: 500000 },
    );

    expect(prisma.member.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: MEMBER_ID },
        data: expect.objectContaining({ largeTxnThreshold: BigInt(500000) }),
      }),
    );
    // BigInt-safe: crosses the API boundary as a string, never a Number.
    expect(result.largeTxnThreshold).toBe("500000");
  });

  it("omitting largeTxnThreshold leaves it unchanged (undefined dropped from the update payload)", async () => {
    prisma.member.update.mockResolvedValue({
      id: MEMBER_ID,
      userId: MEMBER_USER_ID,
      familyGroupId: FAMILY_GROUP_ID,
      role: Role.operational,
      relationship: null,
      largeTxnThreshold: BigInt(500000),
      user: { name: "Supir", email: "supir@example.com" },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await service.updateMemberRole(FAMILY_GROUP_ID, MEMBER_ID, REQUESTER_ID, {
      role: Role.operational,
    });

    const updateArg = prisma.member.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect("largeTxnThreshold" in updateArg.data).toBe(false);
  });

  it("an explicit null clears the threshold (the gate is removed)", async () => {
    prisma.member.update.mockResolvedValue({
      id: MEMBER_ID,
      userId: MEMBER_USER_ID,
      familyGroupId: FAMILY_GROUP_ID,
      role: Role.operational,
      relationship: null,
      largeTxnThreshold: null,
      user: { name: "Supir", email: "supir@example.com" },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const result = await service.updateMemberRole(
      FAMILY_GROUP_ID,
      MEMBER_ID,
      REQUESTER_ID,
      { role: Role.operational, largeTxnThreshold: null },
    );

    expect(prisma.member.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ largeTxnThreshold: null }),
      }),
    );
    expect(result.largeTxnThreshold).toBeNull();
  });
});

// EPIC-023 D1/D6 (US-FAM-12, US-AUTH-9) — head-created dependant/operational
// member: name + username + initial password, no email, forced password
// change at first login. Adversarial-tier coverage: real (unmocked) argon2
// calls prove the credential this endpoint writes is actually compatible
// with better-auth's own verification algorithm, not just "assumed to work".
describe("FamilyGroupsService.createDependantMember (EPIC-023 D1)", () => {
  let service: FamilyGroupsService;
  let tx: {
    user: { findUnique: jest.Mock; create: jest.Mock };
    baAccount: { create: jest.Mock };
    member: { create: jest.Mock; findFirst: jest.Mock };
    $queryRaw: jest.Mock;
  };
  let prisma: { $transaction: jest.Mock };

  const BASE_DTO = {
    name: "Adit Kecil",
    username: "Adit_01",
    initialPassword: "changeMe123",
    role: Role.dependant,
  };

  beforeEach(async () => {
    tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      baAccount: { create: jest.fn() },
      member: {
        create: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $queryRaw: jest.fn().mockResolvedValue(undefined),
    };
    prisma = {
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FamilyGroupsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NOTIFICATION_SENDER_PORT,
          useValue: { sendEmail: jest.fn() },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: RedisService, useValue: makeRedis() },
      ],
    }).compile();
    service = module.get(FamilyGroupsService);
  });

  function mockCreatedRows(overrides?: { userId?: string }) {
    const userId = overrides?.userId ?? "user-new-dependant";
    tx.user.create.mockImplementation(
      async (args: { data: Record<string, unknown> }) => ({
        id: userId,
        ...args.data,
      }),
    );
    tx.baAccount.create.mockImplementation(
      async (args: { data: Record<string, unknown> }) => ({
        id: "ba-1",
        ...args.data,
      }),
    );
    tx.member.create.mockImplementation(
      async (args: { data: Record<string, unknown> }) => ({
        id: "member-new",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        ...args.data,
      }),
    );
    return userId;
  }

  it("rejects a role other than dependant/operational with INVALID_ROLE_FOR_DEPENDANT_CREATION", async () => {
    try {
      await service.createDependantMember(FAMILY_GROUP_ID, {
        ...BASE_DTO,
        role: Role.member,
      });
      throw new Error("expected createDependantMember to reject");
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({
          code: "INVALID_ROLE_FOR_DEPENDANT_CREATION",
        }),
      );
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("accepts 'operational' as well as 'dependant'", async () => {
    mockCreatedRows();
    const result = await service.createDependantMember(FAMILY_GROUP_ID, {
      ...BASE_DTO,
      role: Role.operational,
    });
    expect(result.role).toBe(Role.operational);
  });

  it("normalizes the username to lowercase for both the uniqueness check and storage (case-insensitive enforcement)", async () => {
    mockCreatedRows();
    await service.createDependantMember(FAMILY_GROUP_ID, {
      ...BASE_DTO,
      username: "Adit_01",
    });

    expect(tx.user.findUnique).toHaveBeenCalledWith({
      where: { username: "adit_01" },
      select: { id: true },
    });
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          username: "adit_01",
          displayUsername: "Adit_01",
        }),
      }),
    );
  });

  it("rejects a username already taken, case-insensitively, via the pre-check (USERNAME_TAKEN)", async () => {
    tx.user.findUnique.mockResolvedValue({ id: "existing-user" });

    try {
      await service.createDependantMember(FAMILY_GROUP_ID, BASE_DTO);
      throw new Error("expected createDependantMember to reject");
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual(
        expect.objectContaining({ code: "USERNAME_TAKEN" }),
      );
    }
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it("rejects a genuine race (two concurrent requests for the same username) via the DB's own unique constraint, not just the pre-check", async () => {
    // Pre-check sees no conflict (TOCTOU gap) — the SECOND request's
    // tx.user.create hits the real unique index instead.
    tx.user.findUnique.mockResolvedValue(null);
    tx.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed on the fields: (`username`)",
        {
          code: "P2002",
          clientVersion: "6.19.3",
          meta: { target: ["username"] },
        },
      ),
    );

    try {
      await service.createDependantMember(FAMILY_GROUP_ID, BASE_DTO);
      throw new Error("expected createDependantMember to reject");
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual(
        expect.objectContaining({ code: "USERNAME_TAKEN" }),
      );
    }
  });

  it("does not swallow an unrelated P2002 (e.g. on a different unique column)", async () => {
    tx.user.findUnique.mockResolvedValue(null);
    const unrelated = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed on the fields: (`email`)",
      {
        code: "P2002",
        clientVersion: "6.19.3",
        meta: { target: ["email"] },
      },
    );
    tx.user.create.mockRejectedValue(unrelated);

    await expect(
      service.createDependantMember(FAMILY_GROUP_ID, BASE_DTO),
    ).rejects.toBe(unrelated);
  });

  it("creates User + credential BaAccount + Member atomically with the correct shape", async () => {
    const userId = mockCreatedRows();

    const result = await service.createDependantMember(FAMILY_GROUP_ID, {
      ...BASE_DTO,
      relationship: "anak",
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    // User row: synthetic, reserved-TLD email; mustChangePassword true.
    expect(tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Adit Kecil",
        username: "adit_01",
        displayUsername: "Adit_01",
        mustChangePassword: true,
        emailVerified: false,
      }),
    });
    const userCreateArgs = tx.user.create.mock.calls[0][0] as {
      data: { email: string; avatarInitials: string };
    };
    expect(userCreateArgs.data.email).toMatch(
      /^member-[0-9a-f-]{36}@members\.internal\.wealthme\.invalid$/,
    );
    expect(userCreateArgs.data.avatarInitials).toBe("AK");

    // Credential BaAccount row: EXACT convention better-auth's own
    // /sign-up/email route uses (verified against
    // node_modules/.../better-auth/dist/api/routes/sign-up.mjs:
    // `linkAccount({ userId, providerId: "credential", accountId: createdUser.id, password: hash })`).
    expect(tx.baAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId,
        providerId: "credential",
        accountId: userId,
      }),
    });
    const baAccountArgs = tx.baAccount.create.mock.calls[0][0] as {
      data: { password: string };
    };
    // Real argon2id hash, not a placeholder — verified end-to-end below.
    expect(baAccountArgs.data.password).toMatch(/^\$argon2id\$/);

    // Member row: attached to the caller's own familyGroupId, role +
    // relationship as given — never "manage"/never inherits the head's role.
    expect(tx.member.create).toHaveBeenCalledWith({
      data: {
        userId,
        familyGroupId: FAMILY_GROUP_ID,
        role: Role.dependant,
        relationship: "anak",
      },
    });

    // Response never leaks the password/hash.
    expect(result).not.toHaveProperty("password");
    expect(result).not.toHaveProperty("initialPassword");
    expect(JSON.stringify(result)).not.toContain(baAccountArgs.data.password);
    expect(result.username).toBe("adit_01");
  });

  // Adversarial-tier requirement: prove the created dependant can actually
  // authenticate afterward — through the REAL argon2 hash/verify path, not
  // a mock that assumes it works. This reproduces better-auth's own
  // `signInUsername` verification algorithm exactly as read from its
  // source (node_modules/.../better-auth/dist/plugins/username/index.mjs):
  // normalize the submitted username the same way, look up the `account`
  // row with `providerId: "credential"` for that user, then
  // `ctx.context.password.verify({ hash: account.password, password })` —
  // which in this codebase IS `argon2.verify(hash, password)` (see
  // apps/web/src/lib/auth.ts's `emailAndPassword.password.verify`). No live
  // DB/better-auth server is reachable from this sandbox (see task notes),
  // so this test stands in for that lookup with the EXACT row our service
  // wrote, exercising the REAL, unmocked `argon2` module for the actual
  // hash-then-verify round trip.
  it("the credential row this endpoint writes is genuinely verifiable via argon2 (mirrors signInUsername's real algorithm)", async () => {
    mockCreatedRows();

    await service.createDependantMember(FAMILY_GROUP_ID, {
      ...BASE_DTO,
      initialPassword: "correctHorseBattery1",
    });

    const baAccountArgs = tx.baAccount.create.mock.calls[0][0] as {
      data: { password: string };
    };
    const storedHash = baAccountArgs.data.password;

    // Positive: the real initial password verifies against the real stored
    // hash, using the SAME argon2 call better-auth's own verify() makes.
    await expect(
      argon2.verify(storedHash, "correctHorseBattery1"),
    ).resolves.toBe(true);
    // Negative: a wrong password must NOT verify — proves this isn't a
    // tautology that would pass for any hash.
    await expect(argon2.verify(storedHash, "wrong-password")).resolves.toBe(
      false,
    );
  }, 15000);
});

// EPIC-024 A1 (D1) — istri = co-master: role owner is ONLY accepted paired
// with relationship istri, never gets her own family group, and a second
// istri in the same group is refused — including under a concurrent race.
describe("FamilyGroupsService.createDependantMember — istri as second owner (EPIC-024 A1)", () => {
  let service: FamilyGroupsService;
  let tx: {
    user: { findUnique: jest.Mock; create: jest.Mock };
    baAccount: { create: jest.Mock };
    member: { create: jest.Mock; findFirst: jest.Mock };
    $queryRaw: jest.Mock;
  };
  let prisma: { $transaction: jest.Mock };

  const ISTRI_DTO = {
    name: "Sari Wijaya",
    username: "sari_w",
    initialPassword: "changeMe123",
    role: Role.owner,
    relationship: MemberRelationship.istri,
  } as const;

  beforeEach(async () => {
    tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      baAccount: { create: jest.fn() },
      member: {
        create: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $queryRaw: jest.fn().mockResolvedValue(undefined),
    };
    prisma = {
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FamilyGroupsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NOTIFICATION_SENDER_PORT,
          useValue: { sendEmail: jest.fn() },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: RedisService, useValue: makeRedis() },
      ],
    }).compile();
    service = module.get(FamilyGroupsService);
  });

  function mockCreatedRows(userId = "user-istri") {
    tx.user.create.mockImplementation(
      async (args: { data: Record<string, unknown> }) => ({
        id: userId,
        ...args.data,
      }),
    );
    tx.baAccount.create.mockImplementation(
      async (args: { data: Record<string, unknown> }) => ({
        id: "ba-istri",
        ...args.data,
      }),
    );
    tx.member.create.mockImplementation(
      async (args: { data: Record<string, unknown> }) => ({
        id: "member-istri",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        ...args.data,
      }),
    );
    return userId;
  }

  it("rejects role owner when relationship is NOT istri", async () => {
    await expect(
      service.createDependantMember(FAMILY_GROUP_ID, {
        ...ISTRI_DTO,
        relationship: MemberRelationship.anak,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "INVALID_ROLE_FOR_DEPENDANT_CREATION",
      }),
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("accepts role owner paired with relationship istri: creates a Member row in the SAME family group, no new FamilyGroup", async () => {
    const userId = mockCreatedRows();

    const result = await service.createDependantMember(
      FAMILY_GROUP_ID,
      ISTRI_DTO,
    );

    // Locks the family group row first (race guard) before the istri recheck.
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.member.findFirst).toHaveBeenCalledWith({
      where: { familyGroupId: FAMILY_GROUP_ID, relationship: "istri" },
      select: { id: true },
    });
    // The Member row is created directly on the CALLER's familyGroupId —
    // this service never calls familyGroup.create, so no second family
    // group can exist for her.
    expect(tx.member.create).toHaveBeenCalledWith({
      data: {
        userId,
        familyGroupId: FAMILY_GROUP_ID,
        role: Role.owner,
        relationship: MemberRelationship.istri,
      },
    });
    expect(result.role).toBe(Role.owner);
    expect(result.relationship).toBe(MemberRelationship.istri);
  });

  it("refuses a second istri in a family group that already has one", async () => {
    tx.member.findFirst.mockResolvedValue({ id: "existing-istri-member" });

    await expect(
      service.createDependantMember(FAMILY_GROUP_ID, ISTRI_DTO),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "MAX_ONE_ISTRI" }),
    });
    expect(tx.member.create).not.toHaveBeenCalled();
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  // Adversarial-review target: a naive `count() -> create()` check would
  // read count=0 on BOTH concurrent requests before either writes, letting
  // two istri rows through. This test proves the SECOND call sees the
  // FIRST call's row — i.e. the check is not evaluated against stale state
  // — by having `findFirst` return the just-created row on its second
  // invocation, exactly as it would once the first transaction's `FOR
  // UPDATE` lock releases and the second transaction's recheck runs.
  it("a second concurrent istri request is refused once the first transaction's write is visible (race-safe recheck, not a stale read)", async () => {
    let callCount = 0;
    tx.member.findFirst.mockImplementation(async () => {
      callCount += 1;
      // First call (request A's recheck): no istri yet.
      // Second call (request B's recheck, AFTER A committed under the
      // FamilyGroup row lock): sees A's row.
      return callCount === 1 ? null : { id: "member-istri-from-request-a" };
    });
    mockCreatedRows();

    await service.createDependantMember(FAMILY_GROUP_ID, ISTRI_DTO);
    await expect(
      service.createDependantMember(FAMILY_GROUP_ID, {
        ...ISTRI_DTO,
        username: "sari_w_2",
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "MAX_ONE_ISTRI" }),
    });

    expect(tx.member.create).toHaveBeenCalledTimes(1);
  });

  it("does not run the istri max-1 check for a plain dependant/operational creation (no unnecessary lock)", async () => {
    mockCreatedRows();
    await service.createDependantMember(FAMILY_GROUP_ID, {
      name: "Adit",
      username: "adit_dep",
      initialPassword: "changeMe123",
      role: Role.dependant,
    });

    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.member.findFirst).not.toHaveBeenCalled();
  });
});

describe("FamilyGroupsService.resetMemberPassword", () => {
  let service: FamilyGroupsService;
  let prisma: ReturnType<typeof makePrisma>;
  let redis: ReturnType<typeof makeRedis>;

  const MANAGED_EMAIL = "member-x@members.internal.wealthme.invalid";

  beforeEach(async () => {
    prisma = makePrisma();
    redis = makeRedis();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FamilyGroupsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NOTIFICATION_SENDER_PORT,
          useValue: { sendEmail: jest.fn() },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();
    service = module.get(FamilyGroupsService);
    prisma.member.findUnique.mockResolvedValue({ role: "owner" });
    prisma.baAccount.updateMany.mockResolvedValue({ count: 1 });
  });

  const reset = () =>
    service.resetMemberPassword(FAMILY_GROUP_ID, MEMBER_ID, REQUESTER_ID, {
      newPassword: "rahasia-baru-123",
    });

  it("rejects a non-owner requester", async () => {
    prisma.member.findUnique.mockResolvedValue({ role: "dependant" });
    await expect(reset()).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.baAccount.updateMany).not.toHaveBeenCalled();
  });

  it("404s a member outside this family group", async () => {
    prisma.member.findFirst.mockResolvedValue(null);
    await expect(reset()).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.member.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: MEMBER_ID, familyGroupId: FAMILY_GROUP_ID },
      }),
    );
  });

  it("refuses to reset the requester's own password", async () => {
    prisma.member.findFirst.mockResolvedValue({
      userId: REQUESTER_ID,
      user: { email: MANAGED_EMAIL },
    });
    await expect(reset()).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.baAccount.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a member who signs in with a real email", async () => {
    prisma.member.findFirst.mockResolvedValue({
      userId: MEMBER_USER_ID,
      user: { email: "istri@gmail.com" },
    });
    await expect(reset()).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.baAccount.updateMany).not.toHaveBeenCalled();
  });

  it("stores an argon2 hash of the temporary password and forces a change at next login", async () => {
    prisma.member.findFirst.mockResolvedValue({
      userId: MEMBER_USER_ID,
      user: { email: MANAGED_EMAIL },
    });
    await reset();

    const call = prisma.baAccount.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({
      userId: MEMBER_USER_ID,
      providerId: "credential",
    });
    expect(call.data.password).not.toBe("rahasia-baru-123");
    await expect(
      argon2.verify(call.data.password, "rahasia-baru-123"),
    ).resolves.toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: MEMBER_USER_ID },
      data: { mustChangePassword: true },
    });
  });

  it("fails when the member has no credential login to update", async () => {
    prisma.member.findFirst.mockResolvedValue({
      userId: MEMBER_USER_ID,
      user: { email: MANAGED_EMAIL },
    });
    prisma.baAccount.updateMany.mockResolvedValue({ count: 0 });
    await expect(reset()).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("signs the member out everywhere after the change", async () => {
    prisma.member.findFirst.mockResolvedValue({
      userId: MEMBER_USER_ID,
      user: { email: MANAGED_EMAIL },
    });
    await reset();
    expect(redis.del).toHaveBeenCalledWith(`refresh:${MEMBER_USER_ID}`);
    expect(prisma.baSession.deleteMany).toHaveBeenCalledWith({
      where: { userId: MEMBER_USER_ID },
    });
  });
});
