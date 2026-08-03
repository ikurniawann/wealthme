import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { Prisma } from "@prisma/client";

import { CryptoService } from "../crypto/crypto.service";
import { PrismaService } from "../prisma/prisma.service";

import { AccountsService } from "./accounts.service";
import { AccountOwnerFilter } from "./dto/list-accounts-query.dto";

const FAMILY_GROUP_ID = "fg-1";
const ACCOUNT_ID = "account-1";

function makePrisma() {
  return {
    account: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    // EPIC-019 Task A — assertOwnerIsFamilyMember() looks up a Member row
    // when ownerUserId is set on create/update. Default null (no matching
    // member) so any test that doesn't explicitly mock this stays a no-op
    // unless it opts into passing ownerUserId.
    member: { findUnique: jest.fn().mockResolvedValue(null) },
    donation: { updateMany: jest.fn() },
    // EPIC-021 Group B — remove() checks this before attempting the delete.
    // Default to 0 (no outgoing transfers) so pre-existing tests that don't
    // care about transfers keep passing unmodified.
    transaction: { count: jest.fn().mockResolvedValue(0) },
    $transaction: jest.fn(async (ops: Array<Promise<unknown>>) =>
      Promise.all(ops),
    ),
  };
}

describe("AccountsService.remove", () => {
  let service: AccountsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CryptoService, useValue: {} },
      ],
    }).compile();
    service = module.get(AccountsService);
  });

  it("clears dangling donation links before deleting the account", async () => {
    prisma.account.findUnique.mockResolvedValue({
      id: ACCOUNT_ID,
      familyGroupId: FAMILY_GROUP_ID,
    });
    prisma.donation.updateMany.mockResolvedValue({ count: 1 });
    prisma.account.delete.mockResolvedValue({ id: ACCOUNT_ID });

    await service.remove(FAMILY_GROUP_ID, ACCOUNT_ID);

    expect(prisma.transaction.count).toHaveBeenCalledWith({
      where: {
        familyGroupId: FAMILY_GROUP_ID,
        accountId: ACCOUNT_ID,
        toAccountId: { not: null },
      },
    });
    expect(prisma.donation.updateMany).toHaveBeenCalledWith({
      where: { familyGroupId: FAMILY_GROUP_ID, accountId: ACCOUNT_ID },
      data: { accountId: null, transactionId: null },
    });
    expect(prisma.account.delete).toHaveBeenCalledWith({
      where: { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("rejects deletion when the account is the SOURCE of a real transfer (#23/#27/#28 cascade-corruption guard)", async () => {
    prisma.account.findUnique.mockResolvedValue({
      id: ACCOUNT_ID,
      familyGroupId: FAMILY_GROUP_ID,
    });
    prisma.transaction.count.mockResolvedValue(1);

    await expect(service.remove(FAMILY_GROUP_ID, ACCOUNT_ID)).rejects.toThrow(
      ConflictException,
    );
    // Must never reach the delete — the destination's credit would be
    // orphaned by the accountId cascade.
    expect(prisma.account.delete).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects deletion when the account is the DESTINATION of a transfer (Restrict FK P2003 -> clean 4xx)", async () => {
    prisma.account.findUnique.mockResolvedValue({
      id: ACCOUNT_ID,
      familyGroupId: FAMILY_GROUP_ID,
    });
    // Not a source of any transfer — only the toAccountId Restrict FK fires.
    prisma.transaction.count.mockResolvedValue(0);
    prisma.donation.updateMany.mockResolvedValue({ count: 0 });
    const p2003 = new Prisma.PrismaClientKnownRequestError(
      "Foreign key constraint failed on the field: `toAccountId`",
      { code: "P2003", clientVersion: "6.19.3" },
    );
    prisma.account.delete.mockRejectedValue(p2003);

    await expect(service.remove(FAMILY_GROUP_ID, ACCOUNT_ID)).rejects.toThrow(
      ConflictException,
    );
  });

  it("rethrows non-P2003 errors from the delete transaction unchanged", async () => {
    prisma.account.findUnique.mockResolvedValue({
      id: ACCOUNT_ID,
      familyGroupId: FAMILY_GROUP_ID,
    });
    prisma.transaction.count.mockResolvedValue(0);
    prisma.donation.updateMany.mockResolvedValue({ count: 0 });
    const unrelated = new Error("connection reset");
    prisma.account.delete.mockRejectedValue(unrelated);

    await expect(service.remove(FAMILY_GROUP_ID, ACCOUNT_ID)).rejects.toThrow(
      "connection reset",
    );
  });
});

describe("AccountsService privacy flag", () => {
  let service: AccountsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CryptoService, useValue: {} },
      ],
    }).compile();
    service = module.get(AccountsService);
  });

  it("create defaults isPrivate to false when not provided", async () => {
    prisma.account.create.mockResolvedValue({
      id: ACCOUNT_ID,
      familyGroupId: FAMILY_GROUP_ID,
      name: "Tabungan",
      type: "bank",
      institution: null,
      maskedNumber: null,
      balance: 0n,
      currency: "IDR",
      isPrivate: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.create(FAMILY_GROUP_ID, {
      name: "Tabungan",
      type: "bank",
      balance: 0,
    });

    expect(prisma.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPrivate: false }),
      }),
    );
  });

  it("create persists isPrivate: true when set by the owner", async () => {
    prisma.account.create.mockResolvedValue({
      id: ACCOUNT_ID,
      familyGroupId: FAMILY_GROUP_ID,
      name: "Rekening Pribadi",
      type: "bank",
      institution: null,
      maskedNumber: null,
      balance: 0n,
      currency: "IDR",
      isPrivate: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.create(FAMILY_GROUP_ID, {
      name: "Rekening Pribadi",
      type: "bank",
      balance: 0,
      isPrivate: true,
    });

    expect(prisma.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPrivate: true }),
      }),
    );
    expect(result.isPrivate).toBe(true);
  });

  it("update persists a toggled isPrivate flag", async () => {
    prisma.account.findUnique.mockResolvedValue({
      id: ACCOUNT_ID,
      familyGroupId: FAMILY_GROUP_ID,
    });
    prisma.account.update.mockResolvedValue({
      id: ACCOUNT_ID,
      familyGroupId: FAMILY_GROUP_ID,
      name: "Tabungan",
      type: "bank",
      institution: null,
      maskedNumber: null,
      balance: 0n,
      currency: "IDR",
      isPrivate: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.update(FAMILY_GROUP_ID, ACCOUNT_ID, {
      isPrivate: true,
    });

    expect(prisma.account.update).toHaveBeenCalledWith({
      where: { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
      data: { isPrivate: true },
      include: { owner: { select: { name: true } } },
    });
    expect(result.isPrivate).toBe(true);
  });

  it("update leaves isPrivate untouched when not provided in the patch", async () => {
    prisma.account.findUnique.mockResolvedValue({
      id: ACCOUNT_ID,
      familyGroupId: FAMILY_GROUP_ID,
    });
    prisma.account.update.mockResolvedValue({
      id: ACCOUNT_ID,
      familyGroupId: FAMILY_GROUP_ID,
      name: "Renamed",
      type: "bank",
      institution: null,
      maskedNumber: null,
      balance: 0n,
      currency: "IDR",
      isPrivate: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.update(FAMILY_GROUP_ID, ACCOUNT_ID, { name: "Renamed" });

    expect(prisma.account.update).toHaveBeenCalledWith({
      where: { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
      data: { name: "Renamed" },
      include: { owner: { select: { name: true } } },
    });
  });
});

interface FakeAccount {
  id: string;
  familyGroupId: string;
  name: string;
  type: string;
  institution: string | null;
  maskedNumber: string | null;
  balance: bigint;
  currency: string;
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PRIVATE_ACCOUNT_ID = "account-private";

function buildFixtureAccounts(): FakeAccount[] {
  const now = new Date();
  return [
    {
      id: ACCOUNT_ID,
      familyGroupId: FAMILY_GROUP_ID,
      name: "Visible",
      type: "bank",
      institution: null,
      maskedNumber: null,
      balance: 100n,
      currency: "IDR",
      isPrivate: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: PRIVATE_ACCOUNT_ID,
      familyGroupId: FAMILY_GROUP_ID,
      name: "Private",
      type: "bank",
      institution: null,
      maskedNumber: null,
      balance: 500n,
      currency: "IDR",
      isPrivate: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

/**
 * A minimal in-memory Prisma stand-in that honors the `isPrivate` filter the
 * service builds via `accountPrivacyWhere`, so these tests exercise real
 * filtering behavior rather than just call shapes.
 */
function makeFakePrisma(accounts: FakeAccount[]) {
  return {
    account: {
      findMany: jest.fn(({ where }: { where: { isPrivate?: boolean } }) => {
        const rows =
          where.isPrivate === false
            ? accounts.filter((a) => !a.isPrivate)
            : accounts;
        return Promise.resolve(rows);
      }),
      findUnique: jest.fn(
        ({
          where,
        }: {
          where: { id: string; familyGroupId: string; isPrivate?: boolean };
        }) => {
          const account = accounts.find(
            (a) =>
              a.id === where.id &&
              a.familyGroupId === where.familyGroupId &&
              (where.isPrivate === undefined ||
                a.isPrivate === where.isPrivate),
          );
          return Promise.resolve(account ?? null);
        },
      ),
    },
  };
}

describe("AccountsService privacy enforcement", () => {
  let service: AccountsService;
  let prisma: ReturnType<typeof makeFakePrisma>;

  beforeEach(async () => {
    prisma = makeFakePrisma(buildFixtureAccounts());
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CryptoService, useValue: {} },
      ],
    }).compile();
    service = module.get(AccountsService);
  });

  it("findAll excludes private accounts for a member viewer", async () => {
    const result = await service.findAll(FAMILY_GROUP_ID, false);
    expect(result.map((a) => a.id)).toEqual([ACCOUNT_ID]);
  });

  it("findAll includes private accounts for an owner/admin_staff viewer", async () => {
    const result = await service.findAll(FAMILY_GROUP_ID, true);
    expect(result.map((a) => a.id).sort()).toEqual(
      [ACCOUNT_ID, PRIVATE_ACCOUNT_ID].sort(),
    );
  });

  it("findAll defaults to unfiltered when canSeePrivate is omitted (internal callers)", async () => {
    const result = await service.findAll(FAMILY_GROUP_ID);
    expect(result.map((a) => a.id).sort()).toEqual(
      [ACCOUNT_ID, PRIVATE_ACCOUNT_ID].sort(),
    );
  });

  it("findOne throws NotFoundException for a private account when the viewer is a member", async () => {
    await expect(
      service.findOne(FAMILY_GROUP_ID, PRIVATE_ACCOUNT_ID, false),
    ).rejects.toThrow(NotFoundException);
  });

  it("findOne returns a private account for an owner/admin_staff viewer", async () => {
    const result = await service.findOne(
      FAMILY_GROUP_ID,
      PRIVATE_ACCOUNT_ID,
      true,
    );
    expect(result.id).toBe(PRIVATE_ACCOUNT_ID);
    expect(result.isPrivate).toBe(true);
  });

  it("findOne still returns a visible account for a member viewer", async () => {
    const result = await service.findOne(FAMILY_GROUP_ID, ACCOUNT_ID, false);
    expect(result.id).toBe(ACCOUNT_ID);
  });
});

// EPIC-019 Task A — per-member account ownership.
const MEMBER_USER_ID = "user-member-1";
const OTHER_FAMILY_USER_ID = "user-cross-tenant";

describe("AccountsService ownership assignment", () => {
  let service: AccountsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CryptoService, useValue: {} },
      ],
    }).compile();
    service = module.get(AccountsService);
  });

  it("create rejects ownerUserId for a user who is not a member of this family group", async () => {
    prisma.member.findUnique.mockResolvedValue(null);

    await expect(
      service.create(FAMILY_GROUP_ID, {
        name: "Rekening Anak",
        type: "bank",
        balance: 0,
        ownerUserId: OTHER_FAMILY_USER_ID,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.account.create).not.toHaveBeenCalled();
  });

  it("create persists ownerUserId when the target is a member of the same family group", async () => {
    prisma.member.findUnique.mockResolvedValue({ id: "member-1" });
    prisma.account.create.mockResolvedValue({
      id: ACCOUNT_ID,
      familyGroupId: FAMILY_GROUP_ID,
      name: "Rekening Anak",
      type: "bank",
      institution: null,
      maskedNumber: null,
      balance: 0n,
      currency: "IDR",
      isPrivate: false,
      ownerUserId: MEMBER_USER_ID,
      owner: { name: "Anak Pertama" },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.create(FAMILY_GROUP_ID, {
      name: "Rekening Anak",
      type: "bank",
      balance: 0,
      ownerUserId: MEMBER_USER_ID,
    });

    expect(prisma.member.findUnique).toHaveBeenCalledWith({
      where: {
        userId_familyGroupId: {
          userId: MEMBER_USER_ID,
          familyGroupId: FAMILY_GROUP_ID,
        },
      },
      select: { id: true },
    });
    expect(prisma.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ownerUserId: MEMBER_USER_ID }),
      }),
    );
    expect(result.ownerUserId).toBe(MEMBER_USER_ID);
    expect(result.ownerName).toBe("Anak Pertama");
  });

  it("update rejects reassigning to a cross-tenant/non-member user id", async () => {
    prisma.account.findUnique.mockResolvedValue({
      id: ACCOUNT_ID,
      familyGroupId: FAMILY_GROUP_ID,
    });
    prisma.member.findUnique.mockResolvedValue(null);

    await expect(
      service.update(FAMILY_GROUP_ID, ACCOUNT_ID, {
        ownerUserId: OTHER_FAMILY_USER_ID,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.account.update).not.toHaveBeenCalled();
  });

  it("update reassigns ownerUserId when the target is a valid member", async () => {
    prisma.account.findUnique.mockResolvedValue({
      id: ACCOUNT_ID,
      familyGroupId: FAMILY_GROUP_ID,
    });
    prisma.member.findUnique.mockResolvedValue({ id: "member-1" });
    prisma.account.update.mockResolvedValue({
      id: ACCOUNT_ID,
      familyGroupId: FAMILY_GROUP_ID,
      name: "Tabungan",
      type: "bank",
      institution: null,
      maskedNumber: null,
      balance: 0n,
      currency: "IDR",
      isPrivate: false,
      ownerUserId: MEMBER_USER_ID,
      owner: { name: "Anak Pertama" },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.update(FAMILY_GROUP_ID, ACCOUNT_ID, {
      ownerUserId: MEMBER_USER_ID,
    });

    expect(prisma.account.update).toHaveBeenCalledWith({
      where: { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
      data: { ownerUserId: MEMBER_USER_ID },
      include: { owner: { select: { name: true } } },
    });
    expect(result.ownerUserId).toBe(MEMBER_USER_ID);
  });

  it("update clears ownership back to family-shared when ownerUserId is explicitly null", async () => {
    prisma.account.findUnique.mockResolvedValue({
      id: ACCOUNT_ID,
      familyGroupId: FAMILY_GROUP_ID,
    });
    prisma.account.update.mockResolvedValue({
      id: ACCOUNT_ID,
      familyGroupId: FAMILY_GROUP_ID,
      name: "Tabungan",
      type: "bank",
      institution: null,
      maskedNumber: null,
      balance: 0n,
      currency: "IDR",
      isPrivate: false,
      ownerUserId: null,
      owner: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.update(FAMILY_GROUP_ID, ACCOUNT_ID, {
      ownerUserId: null,
    });

    expect(prisma.member.findUnique).not.toHaveBeenCalled();
    expect(prisma.account.update).toHaveBeenCalledWith({
      where: { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
      data: { ownerUserId: null },
      include: { owner: { select: { name: true } } },
    });
    expect(result.ownerUserId).toBeNull();
    expect(result.ownerName).toBeNull();
  });

  it("update leaves ownership untouched when ownerUserId is omitted from the patch", async () => {
    prisma.account.findUnique.mockResolvedValue({
      id: ACCOUNT_ID,
      familyGroupId: FAMILY_GROUP_ID,
    });
    prisma.account.update.mockResolvedValue({
      id: ACCOUNT_ID,
      familyGroupId: FAMILY_GROUP_ID,
      name: "Renamed",
      type: "bank",
      institution: null,
      maskedNumber: null,
      balance: 0n,
      currency: "IDR",
      isPrivate: false,
      ownerUserId: MEMBER_USER_ID,
      owner: { name: "Anak Pertama" },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.update(FAMILY_GROUP_ID, ACCOUNT_ID, { name: "Renamed" });

    expect(prisma.member.findUnique).not.toHaveBeenCalled();
    expect(prisma.account.update).toHaveBeenCalledWith({
      where: { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
      data: { name: "Renamed" },
      include: { owner: { select: { name: true } } },
    });
  });
});

interface OwnedFakeAccount {
  id: string;
  familyGroupId: string;
  name: string;
  type: string;
  institution: string | null;
  maskedNumber: string | null;
  balance: bigint;
  currency: string;
  isPrivate: boolean;
  ownerUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function makeOwnerFilterPrisma(accounts: OwnedFakeAccount[]) {
  return {
    account: {
      findMany: jest.fn(
        ({ where }: { where: { ownerUserId?: string | null } }) => {
          const rows =
            where.ownerUserId === undefined
              ? accounts
              : accounts.filter((a) => a.ownerUserId === where.ownerUserId);
          return Promise.resolve(rows);
        },
      ),
    },
  };
}

describe("AccountsService owner=me|family|all filter", () => {
  let service: AccountsService;

  const FAMILY_SHARED_ID = "account-shared";
  const OWNED_BY_ME_ID = "account-mine";
  const OWNED_BY_OTHER_ID = "account-other-member";

  function buildAccounts(): OwnedFakeAccount[] {
    const now = new Date();
    const base = {
      type: "bank",
      institution: null,
      maskedNumber: null,
      balance: 0n,
      currency: "IDR",
      isPrivate: false,
      createdAt: now,
      updatedAt: now,
    };
    return [
      {
        ...base,
        id: FAMILY_SHARED_ID,
        familyGroupId: FAMILY_GROUP_ID,
        name: "Shared",
        ownerUserId: null,
      },
      {
        ...base,
        id: OWNED_BY_ME_ID,
        familyGroupId: FAMILY_GROUP_ID,
        name: "Mine",
        ownerUserId: MEMBER_USER_ID,
      },
      {
        ...base,
        id: OWNED_BY_OTHER_ID,
        familyGroupId: FAMILY_GROUP_ID,
        name: "Other",
        ownerUserId: "user-other-member",
      },
    ];
  }

  async function buildService() {
    const prisma = makeOwnerFilterPrisma(buildAccounts());
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CryptoService, useValue: {} },
      ],
    }).compile();
    return module.get(AccountsService);
  }

  beforeEach(async () => {
    service = await buildService();
  });

  it("owner=all (default) returns every account regardless of ownerUserId", async () => {
    const result = await service.findAll(FAMILY_GROUP_ID, true);
    expect(result.map((a) => a.id).sort()).toEqual(
      [FAMILY_SHARED_ID, OWNED_BY_ME_ID, OWNED_BY_OTHER_ID].sort(),
    );
  });

  it("owner=me returns only accounts owned by the requesting user", async () => {
    const result = await service.findAll(
      FAMILY_GROUP_ID,
      true,
      AccountOwnerFilter.me,
      MEMBER_USER_ID,
    );
    expect(result.map((a) => a.id)).toEqual([OWNED_BY_ME_ID]);
  });

  it("owner=family returns only family-shared (ownerUserId null) accounts", async () => {
    const result = await service.findAll(
      FAMILY_GROUP_ID,
      true,
      AccountOwnerFilter.family,
    );
    expect(result.map((a) => a.id)).toEqual([FAMILY_SHARED_ID]);
  });

  it("owner=me with no requestingUserId matches nothing (never falls back to all)", async () => {
    const result = await service.findAll(
      FAMILY_GROUP_ID,
      true,
      AccountOwnerFilter.me,
    );
    expect(result).toEqual([]);
  });
});
