import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, Role } from "@prisma/client";

import { AccessService } from "./access.service";

import type { PrismaService } from "../prisma/prisma.service";

const FG = "fg-1";
const OWNER = "user-owner";

function makePrisma() {
  return {
    member: {
      findUnique: jest.fn().mockResolvedValue({ role: Role.owner }),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    accessRole: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

describe("AccessService", () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: AccessService;
  const validRole = {
    name: "Asisten",
    dataScope: "own",
    permissions: { transaksi: "manage", bogus: "manage" },
  };

  beforeEach(() => {
    prisma = makePrisma();
    service = new AccessService(prisma as unknown as PrismaService);
  });

  it("refuses non-owners", async () => {
    prisma.member.findUnique.mockResolvedValue({ role: Role.spouse });
    await expect(service.listRoles(FG, "u")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("creates a role, dropping unknown pages", async () => {
    prisma.accessRole.create.mockImplementation(({ data }) => ({
      id: "r1",
      createdAt: new Date(),
      ...data,
    }));
    const res = await service.createRole(FG, OWNER, validRole);
    expect(prisma.accessRole.create.mock.calls[0][0].data.permissions).toEqual({
      transaksi: "manage",
    });
    expect(res.memberCount).toBe(0);
  });

  it("rejects an invalid level with 400", async () => {
    await expect(
      service.createRole(FG, OWNER, {
        ...validRole,
        permissions: { transaksi: "admin" },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("maps a duplicate name to 409", async () => {
    prisma.accessRole.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "x",
      }),
    );
    await expect(
      service.createRole(FG, OWNER, validRole),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("never lets a role from another family be edited or assigned", async () => {
    prisma.accessRole.findFirst.mockResolvedValue(null);
    await expect(
      service.updateRole(FG, "other-family-role", OWNER, validRole),
    ).rejects.toBeInstanceOf(NotFoundException);
    prisma.member.findFirst.mockResolvedValue({ id: "m", role: Role.member });
    await expect(
      service.setMemberAccess(FG, "m", OWNER, {
        accessRoleId: "other-family-role",
        overrides: {},
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.member.update).not.toHaveBeenCalled();
  });

  it("refuses to customise a Master", async () => {
    prisma.member.findFirst.mockResolvedValue({ id: "m", role: Role.owner });
    await expect(
      service.setMemberAccess(FG, "m", OWNER, {
        accessRoleId: null,
        overrides: { tax: "none" },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("stores overrides, and clears them with an empty map", async () => {
    prisma.member.findFirst.mockResolvedValue({ id: "m", role: Role.member });
    prisma.accessRole.findFirst.mockResolvedValue({ id: "r1" });
    await service.setMemberAccess(FG, "m", OWNER, {
      accessRoleId: "r1",
      overrides: { tax: "none" },
    });
    expect(prisma.member.update).toHaveBeenLastCalledWith({
      where: { id: "m" },
      data: { accessRoleId: "r1", accessOverrides: { tax: "none" } },
    });
    await service.setMemberAccess(FG, "m", OWNER, {
      accessRoleId: null,
      overrides: {},
    });
    expect(prisma.member.update).toHaveBeenLastCalledWith({
      where: { id: "m" },
      data: { accessRoleId: null, accessOverrides: Prisma.DbNull },
    });
  });
  describe('"Lihat saldo" (canViewBalances)', () => {
    it("stores the flag for another member", async () => {
      prisma.member.findFirst.mockResolvedValue({
        id: "m",
        role: Role.member,
        userId: "user-tina",
      });
      await service.setMemberAccess(FG, "m", OWNER, {
        accessRoleId: null,
        overrides: {},
        canViewBalances: false,
      });
      expect(prisma.member.update).toHaveBeenLastCalledWith({
        where: { id: "m" },
        data: {
          accessRoleId: null,
          accessOverrides: Prisma.DbNull,
          canViewBalances: false,
        },
      });
    });

    it("leaves the flag unchanged when omitted", async () => {
      prisma.member.findFirst.mockResolvedValue({
        id: "m",
        role: Role.member,
        userId: "user-tina",
      });
      await service.setMemberAccess(FG, "m", OWNER, {
        accessRoleId: null,
        overrides: {},
      });
      const call = prisma.member.update.mock.calls.at(-1)?.[0] as {
        data: Record<string, unknown>;
      };
      expect(call.data).not.toHaveProperty("canViewBalances");
    });

    it("refuses a member flipping their own flag", async () => {
      prisma.member.findFirst.mockResolvedValue({
        id: "m",
        role: Role.member,
        userId: OWNER,
      });
      await expect(
        service.setMemberAccess(FG, "m", OWNER, {
          accessRoleId: null,
          overrides: {},
          canViewBalances: true,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.member.update).not.toHaveBeenCalled();
    });

    it("rejects a non-boolean flag", async () => {
      await expect(
        service.setMemberAccess(FG, "m", OWNER, {
          accessRoleId: null,
          overrides: {},
          canViewBalances: "no",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("only a Master may change it", async () => {
      prisma.member.findUnique.mockResolvedValue({ role: Role.member });
      await expect(
        service.setMemberAccess(FG, "m", "user-tina", {
          accessRoleId: null,
          overrides: {},
          canViewBalances: true,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
