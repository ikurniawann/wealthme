import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";
import { Prisma, Role } from "@prisma/client";
import * as argon2 from "argon2";

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
    member: { create: jest.Mock };
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
      member: { create: jest.fn() },
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
