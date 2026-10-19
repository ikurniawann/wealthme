/**
 * Rekening v3 — banking detail and "Dibagikan kepada" on AccountsService:
 * member references are tenant-checked, shares are Master/Co-Master only,
 * and the response carries the new fields.
 */
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Prisma, Role } from "@prisma/client";

import { AccountsService } from "./accounts.service";

const FG = "fg-1";
const MASTER = { userId: "user-master", role: Role.owner };
const CHILD = { userId: "user-child", role: Role.dependant };

function row(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-10-01T00:00:00.000Z");
  return {
    id: "acc-1",
    familyGroupId: FG,
    name: "BCA Tahapan Xpresi",
    type: "bank",
    institution: "BCA",
    maskedNumber: null,
    balance: 10_000_000n,
    currency: "IDR",
    isPrivate: false,
    ownerUserId: null,
    createdAt: now,
    updatedAt: now,
    shares: [],
    ...overrides,
  };
}

function makePrisma(memberIds: string[] = []) {
  const isMember = (userId: string) => memberIds.includes(userId);
  return {
    account: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        // The nested `shares` write is not a returned row.
        Promise.resolve(row({ ...data, shares: [] })),
      ),
      update: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(row({ ...data, shares: [] })),
      ),
      findUnique: jest.fn().mockResolvedValue(row()),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    member: {
      findUnique: jest.fn(
        ({ where }: { where: { userId_familyGroupId: { userId: string } } }) =>
          Promise.resolve(
            isMember(where.userId_familyGroupId.userId) ? { id: "m" } : null,
          ),
      ),
      findMany: jest.fn(({ where }: { where: { userId: { in: string[] } } }) =>
        Promise.resolve(
          where.userId.in.filter(isMember).map((userId) => ({ userId })),
        ),
      ),
    },
    transaction: { groupBy: jest.fn().mockResolvedValue([]) },
  };
}

const crypto = {
  encrypt: jest.fn((v: string) => `enc(${v})`),
  decrypt: jest.fn((v: string) => v.replace(/^enc\((.*)\)$/, "$1")),
};

function service(prisma: ReturnType<typeof makePrisma>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new AccountsService(crypto as any, prisma as any);
}

const BASE = {
  type: "bank" as const,
  name: "BCA Tahapan Xpresi",
  balance: 10_000_000,
};

describe("AccountsService — Rekening v3 bank detail", () => {
  it("stores a member as 'Atas nama' and clears any typed holder name", async () => {
    const prisma = makePrisma(["user-irfan"]);
    const dto = await service(prisma).create(
      FG,
      { ...BASE, holderUserId: "user-irfan", holderName: "ignored" },
      MASTER,
    );
    const data = prisma.account.create.mock.calls[0][0].data;
    expect(data.holderUserId).toBe("user-irfan");
    expect(data.holderName).toBeNull();
    expect(dto.holderUserId).toBe("user-irfan");
  });

  it("rejects an 'Atas nama' member from another family", async () => {
    const prisma = makePrisma([]);
    await expect(
      service(prisma).create(FG, { ...BASE, holderUserId: "user-x" }, MASTER),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.account.create).not.toHaveBeenCalled();
  });

  it("records the opening balance and its date at creation", async () => {
    const prisma = makePrisma();
    const dto = await service(prisma).create(
      FG,
      { ...BASE, openingBalanceDate: "2026-10-01" },
      MASTER,
    );
    const data = prisma.account.create.mock.calls[0][0].data;
    expect(data.openingBalance).toBe(10_000_000n);
    expect(dto.openingBalanceDate).toBe("2026-10-01");
  });

  it("encrypts the deposit bilyet and keeps the interest rate exact", async () => {
    const prisma = makePrisma();
    const dto = await service(prisma).create(
      FG,
      {
        ...BASE,
        productKind: "time_deposit",
        depositNumber: " AA 221047 ",
        interestRate: 4.25,
        placementDate: "2026-09-15",
        tenorMonths: 3,
        maturityInstruction: "aro_plus",
      },
      MASTER,
    );
    const data = prisma.account.create.mock.calls[0][0].data;
    expect(data.depositNumber).toBe("enc(AA 221047)");
    expect(data.interestRate).toEqual(new Prisma.Decimal("4.25"));
    expect(dto.depositNumber).toBe("AA 221047");
    expect(dto.interestRate).toBe(4.25);
    expect(dto.placementDate).toBe("2026-09-15");
  });

  it("rejects a payout account that is the deposit itself", async () => {
    const prisma = makePrisma();
    await expect(
      service(prisma).update(FG, "acc-1", { payoutAccountId: "acc-1" }, MASTER),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects a payout account outside the family", async () => {
    const prisma = makePrisma();
    await expect(
      service(prisma).update(FG, "acc-1", { payoutAccountId: "acc-x" }, MASTER),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.account.findFirst).toHaveBeenCalledWith({
      where: { id: "acc-x", familyGroupId: FG },
      select: { id: true },
    });
  });

  it("upper-cases a SWIFT code", async () => {
    const prisma = makePrisma();
    await service(prisma).update(
      FG,
      "acc-1",
      { swiftCode: "cenaidja" },
      MASTER,
    );
    expect(prisma.account.update.mock.calls[0][0].data.swiftCode).toBe(
      "CENAIDJA",
    );
  });
});

describe("AccountsService — Dibagikan kepada (shares)", () => {
  it("DENIAL — a non-Master cannot set who an account is shared with", async () => {
    const prisma = makePrisma(["user-child", "user-rina"]);
    prisma.account.findUnique.mockResolvedValue(
      row({ ownerUserId: "user-child" }),
    );
    await expect(
      service(prisma).update(
        FG,
        "acc-1",
        { shares: [{ userId: "user-rina", canPost: true }] },
        CHILD,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.account.update).not.toHaveBeenCalled();
  });

  it("replaces the share list, dropping duplicates and the owner", async () => {
    const prisma = makePrisma(["user-rina", "user-mel"]);
    prisma.account.findUnique.mockResolvedValue(
      row({ ownerUserId: "user-mel" }),
    );
    await service(prisma).update(
      FG,
      "acc-1",
      {
        shares: [
          { userId: "user-rina", canPost: false },
          { userId: "user-rina", canPost: true },
          { userId: "user-mel", canPost: true },
        ],
      },
      MASTER,
    );
    expect(prisma.account.update.mock.calls[0][0].data.shares).toEqual({
      deleteMany: {},
      create: [{ userId: "user-rina", canPost: true }],
    });
  });

  it("rejects a share naming someone outside the family", async () => {
    const prisma = makePrisma(["user-rina"]);
    await expect(
      service(prisma).create(
        FG,
        { ...BASE, shares: [{ userId: "user-stranger", canPost: true }] },
        MASTER,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("leaves shares untouched when the patch omits them", async () => {
    const prisma = makePrisma();
    await service(prisma).update(FG, "acc-1", { name: "Baru" }, MASTER);
    expect(prisma.account.update.mock.calls[0][0].data).not.toHaveProperty(
      "shares",
    );
  });

  it("returns shares with member names and the last activity date", async () => {
    const prisma = makePrisma();
    prisma.account.findMany.mockResolvedValue([
      row({
        shares: [
          { userId: "user-rina", canPost: true, user: { name: "Rina S." } },
        ],
      }),
    ]);
    prisma.transaction.groupBy
      .mockResolvedValueOnce([
        { accountId: "acc-1", _max: { occurredAt: new Date("2026-10-10") } },
      ])
      .mockResolvedValueOnce([
        { toAccountId: "acc-1", _max: { occurredAt: new Date("2026-10-12") } },
      ]);
    const [dto] = await service(prisma).findAll(FG);
    expect(dto.shares).toEqual([
      { userId: "user-rina", name: "Rina S.", canPost: true },
    ]);
    expect(dto.lastActivityAt).toBe("2026-10-12");
  });
});
