import { ForbiddenException } from "@nestjs/common";
import { resolveEffectiveAccess } from "@wealthme/contracts";

import { PageAccessGuard } from "./page-access.guard";

import type { Reflector } from "@nestjs/core";

function ctx(req: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as never;
}

describe("PageAccessGuard", () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
  const guard = new PageAccessGuard(reflector);
  const member = resolveEffectiveAccess({
    role: "member",
    accessRole: { dataScope: "all", permissions: { tujuan: "view" } },
  });
  const tenant = (access = member) => ({
    method: "GET",
    tenantContext: { familyGroupId: "fg", access },
  });

  beforeEach(() => (reflector.getAllAndOverride as jest.Mock).mockReset());

  it("ignores non-family routes", () => {
    expect(
      guard.canActivate(
        ctx({ tenantContext: { familyGroupId: null, access: null } }),
      ),
    ).toBe(true);
  });

  it("fails CLOSED on a family route with no @PageAccess", () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    expect(() => guard.canActivate(ctx(tenant()))).toThrow(ForbiddenException);
  });

  it("lets the Master through an undecorated route", () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    expect(
      guard.canActivate(ctx(tenant(resolveEffectiveAccess({ role: "owner" })))),
    ).toBe(true);
  });

  it("allows a granted page and refuses an ungranted one", () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue("goals");
    expect(guard.canActivate(ctx(tenant()))).toBe(true);
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue("tax");
    expect(() => guard.canActivate(ctx(tenant()))).toThrow(ForbiddenException);
  });

  it("refuses a write with view-only access", () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue("goals");
    expect(() =>
      guard.canActivate(ctx({ ...tenant(), method: "POST" })),
    ).toThrow(ForbiddenException);
  });
});
