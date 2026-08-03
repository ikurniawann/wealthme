import { ConflictException, NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { Prisma } from "@prisma/client";

import { CryptoService } from "../crypto/crypto.service";
import { PrismaService } from "../prisma/prisma.service";

import { AccountsService } from "./accounts.service";

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
