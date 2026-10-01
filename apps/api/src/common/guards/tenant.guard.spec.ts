import { ForbiddenException } from "@nestjs/common";
import { Role } from "@prisma/client";

import { TenantGuard } from "./tenant.guard";

const mockPrisma = {
  member: {
    findUnique: jest.fn(),
  },
};

const buildContext = (overrides: {
  user?: { sub: string; email: string };
  params?: Record<string, string>;
}) => {
  const req = {
    user: overrides.user,
    params: overrides.params ?? {},
  };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
    _req: req,
  };
};

describe("TenantGuard", () => {
  let guard: TenantGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new TenantGuard(mockPrisma as never);
  });

  describe("when req.user is absent", () => {
    it("returns true and skips tenant enrichment", async () => {
      // Arrange
      const ctx = buildContext({ user: undefined });

      // Act
      const result = await guard.canActivate(ctx as never);

      // Assert
      expect(result).toBe(true);
      expect(mockPrisma.member.findUnique).not.toHaveBeenCalled();
      expect(
        (ctx._req as Record<string, unknown>)["tenantContext"],
      ).toBeUndefined();
    });
  });

  describe("when familyGroupId is absent", () => {
    it("attaches tenantContext with nulls and returns true", async () => {
      // Arrange
      const ctx = buildContext({ user: { sub: "user-1", email: "u@x.com" } });

      // Act
      const result = await guard.canActivate(ctx as never);

      // Assert
      expect(result).toBe(true);
      expect(mockPrisma.member.findUnique).not.toHaveBeenCalled();
      expect((ctx._req as Record<string, unknown>)["tenantContext"]).toEqual({
        userId: "user-1",
        familyGroupId: null,
        role: null,
        member: null,
        access: null,
      });
    });
  });

  describe("when familyGroupId is in route params", () => {
    it("throws ForbiddenException when member not found", async () => {
      // Arrange
      mockPrisma.member.findUnique.mockResolvedValue(null);
      const ctx = buildContext({
        user: { sub: "user-1", email: "u@x.com" },
        params: { familyGroupId: "group-1" },
      });

      // Act & Assert
      await expect(guard.canActivate(ctx as never)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("attaches tenantContext and returns true when member is found", async () => {
      // Arrange
      const member = {
        id: "member-1",
        userId: "user-1",
        familyGroupId: "group-1",
        role: Role.owner,
      };
      mockPrisma.member.findUnique.mockResolvedValue(member);
      const ctx = buildContext({
        user: { sub: "user-1", email: "u@x.com" },
        params: { familyGroupId: "group-1" },
      });

      // Act
      const result = await guard.canActivate(ctx as never);

      // Assert
      expect(result).toBe(true);
      expect((ctx._req as Record<string, unknown>)["tenantContext"]).toEqual({
        userId: "user-1",
        familyGroupId: "group-1",
        role: Role.owner,
        member: {
          ...member,
          rowScoped: false,
          seesSharedAccounts: true,
          balancesHidden: false,
        },
        access: expect.objectContaining({ isMaster: true, dataScope: "all" }),
      });
    });

    // EPIC-030 — effective access comes from the custom role + overrides.
    it("stamps a custom role's data scope and page levels", async () => {
      mockPrisma.member.findUnique.mockResolvedValue({
        id: "member-2",
        userId: "user-1",
        familyGroupId: "group-1",
        role: Role.member,
        accessOverrides: { tax: "none" },
        accessRole: {
          dataScope: "own",
          permissions: { investasi: "view", tax: "manage" },
        },
      });
      const ctx = buildContext({
        user: { sub: "user-1", email: "u@x.com" },
        params: { familyGroupId: "group-1" },
      });

      await guard.canActivate(ctx as never);

      const tc = (ctx._req as Record<string, any>)["tenantContext"];
      expect(tc.member.rowScoped).toBe(true);
      expect(tc.access.source).toBe("custom-role");
      expect(tc.access.permissions.investasi).toBe("view");
      expect(tc.access.permissions.tax).toBe("none");
      expect(tc.access.permissions.dana).toBe("none");
    });

    it("keeps a dependant without a custom role row-scoped (legacy preset)", async () => {
      mockPrisma.member.findUnique.mockResolvedValue({
        id: "member-3",
        userId: "user-1",
        familyGroupId: "group-1",
        role: Role.dependant,
        accessOverrides: null,
        accessRole: null,
      });
      const ctx = buildContext({
        user: { sub: "user-1", email: "u@x.com" },
        params: { familyGroupId: "group-1" },
      });

      await guard.canActivate(ctx as never);

      const tc = (ctx._req as Record<string, any>)["tenantContext"];
      expect(tc.member.rowScoped).toBe(true);
      // Legacy dependant preset has Bank & Account → sees shared accounts.
      expect(tc.member.seesSharedAccounts).toBe(true);
      expect(tc.access.source).toBe("legacy");
      expect(tc.access.permissions.transaksi).toBe("manage");
      expect(tc.access.permissions.investasi).toBe("none");
    });
  });

  describe("when familyGroupId is in request body only", () => {
    it("does NOT read from body — attaches tenantContext with nulls", async () => {
      // Arrange — body has familyGroupId but params does not
      const req = {
        user: { sub: "user-2", email: "v@x.com" },
        params: {},
        body: { familyGroupId: "group-2" },
      };
      const ctx = {
        switchToHttp: () => ({ getRequest: () => req }),
        getHandler: () => jest.fn(),
        getClass: () => jest.fn(),
        _req: req,
      };

      // Act
      const result = await guard.canActivate(ctx as never);

      // Assert — body-based familyGroupId must be ignored
      expect(result).toBe(true);
      expect(mockPrisma.member.findUnique).not.toHaveBeenCalled();
      expect((req as Record<string, unknown>)["tenantContext"]).toEqual({
        userId: "user-2",
        familyGroupId: null,
        role: null,
        member: null,
        access: null,
      });
    });
  });
});
