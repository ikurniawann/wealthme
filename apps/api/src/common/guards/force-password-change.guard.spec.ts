import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test, type TestingModule } from "@nestjs/testing";

import { PrismaService } from "../../prisma/prisma.service";
import { SKIP_PASSWORD_CHECK_KEY } from "../decorators/skip-password-check.decorator";

import { ForcePasswordChangeGuard } from "./force-password-change.guard";

import type { ExecutionContext } from "@nestjs/common";

const USER_ID = "user-dependant-1";

function makeContext(options: {
  user?: { sub: string; email: string };
  method?: string;
  path?: string;
  skipMetadata?: boolean;
}): ExecutionContext {
  const request = {
    user: options.user,
    method: options.method ?? "GET",
    path: options.path ?? "/family-groups/mine",
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => (): void => {},
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

describe("ForcePasswordChangeGuard (EPIC-023 D1)", () => {
  let guard: ForcePasswordChangeGuard;
  let prisma: { user: { findUnique: jest.Mock } };
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(async () => {
    prisma = { user: { findUnique: jest.fn() } };
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForcePasswordChangeGuard,
        { provide: PrismaService, useValue: prisma },
        { provide: Reflector, useValue: reflector },
      ],
    }).compile();
    guard = module.get(ForcePasswordChangeGuard);
  });

  it("is a no-op when req.user is undefined (unauthenticated / @Public() route)", async () => {
    const ctx = makeContext({ user: undefined });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  // The core adversarial claim: mustChangePassword: true GENUINELY blocks a
  // real protected route (not just "the flag gets set and nothing reads
  // it"). No @SkipPasswordCheck metadata, not on the legacy allowlist.
  it("BLOCKS a real protected route (GET /family-groups/mine) with 403 PASSWORD_CHANGE_REQUIRED when mustChangePassword is true", async () => {
    prisma.user.findUnique.mockResolvedValue({ mustChangePassword: true });
    const ctx = makeContext({
      user: { sub: USER_ID, email: "x@example.com" },
      method: "GET",
      path: "/family-groups/mine",
    });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    try {
      await guard.canActivate(ctx);
      throw new Error("expected canActivate to reject");
    } catch (err) {
      expect((err as ForbiddenException).getResponse()).toEqual(
        expect.objectContaining({ code: "PASSWORD_CHANGE_REQUIRED" }),
      );
    }
  });

  it("also blocks a WRITE route (POST) the same way", async () => {
    prisma.user.findUnique.mockResolvedValue({ mustChangePassword: true });
    const ctx = makeContext({
      user: { sub: USER_ID, email: "x@example.com" },
      method: "POST",
      path: "/transactions",
    });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("is a genuine no-op for mustChangePassword: false — every pre-existing account is unaffected", async () => {
    prisma.user.findUnique.mockResolvedValue({ mustChangePassword: false });
    const ctx = makeContext({
      user: { sub: USER_ID, email: "x@example.com" },
      method: "GET",
      path: "/family-groups/mine",
    });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it("is a no-op when the user row is missing mustChangePassword entirely (defensive default)", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const ctx = makeContext({
      user: { sub: USER_ID, email: "x@example.com" },
      method: "GET",
      path: "/family-groups/mine",
    });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it("allows a route decorated with @SkipPasswordCheck() even when mustChangePassword is true", async () => {
    prisma.user.findUnique.mockResolvedValue({ mustChangePassword: true });
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === SKIP_PASSWORD_CHECK_KEY ? true : undefined,
    );
    const ctx = makeContext({
      user: { sub: USER_ID, email: "x@example.com" },
      method: "POST",
      path: "/auth/set-password",
    });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    // Never even needs the DB lookup once metadata says skip.
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    { method: "GET", path: "/auth/me" },
    { method: "POST", path: "/auth/logout" },
  ])(
    "allows the legacy allowlisted route $method $path even when mustChangePassword is true",
    async ({ method, path }) => {
      prisma.user.findUnique.mockResolvedValue({ mustChangePassword: true });
      const ctx = makeContext({
        user: { sub: USER_ID, email: "x@example.com" },
        method,
        path,
      });

      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    },
  );

  it("does NOT allowlist a route that merely starts with an allowlisted path (e.g. /auth/meetings)", async () => {
    prisma.user.findUnique.mockResolvedValue({ mustChangePassword: true });
    const ctx = makeContext({
      user: { sub: USER_ID, email: "x@example.com" },
      method: "GET",
      path: "/auth/meetings",
    });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("does NOT allowlist GET /auth/logout (wrong method for the allowlisted POST)", async () => {
    prisma.user.findUnique.mockResolvedValue({ mustChangePassword: true });
    const ctx = makeContext({
      user: { sub: USER_ID, email: "x@example.com" },
      method: "GET",
      path: "/auth/logout",
    });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  // EPIC-023 D2 (US-FAM-13, D7) — the epic's own sequencing ("password on
  // first login... afterwards the PIN") means a brand-new account's
  // FIRST-EVER login already requires a password change (D1); PIN
  // registration must only be reachable AFTER that. Registering a device
  // before the mandatory change would let mustChangePassword be bypassed via
  // a side door (set up a PIN, then unlock with it forever without ever
  // having changed the initial password). These routes are deliberately
  // NEITHER on the legacy allowlist NOR decorated with @SkipPasswordCheck(),
  // so the guard's normal (blocking) path applies to them exactly like any
  // other protected route.
  it.each([
    { method: "POST", path: "/auth/devices" },
    { method: "GET", path: "/auth/devices" },
    { method: "POST", path: "/auth/devices/device-1/pin" },
    { method: "DELETE", path: "/auth/devices/device-1" },
  ])(
    "BLOCKS $method $path with 403 PASSWORD_CHANGE_REQUIRED — device registration/PIN setup must wait until AFTER the forced password change",
    async ({ method, path }) => {
      prisma.user.findUnique.mockResolvedValue({ mustChangePassword: true });
      const ctx = makeContext({
        user: { sub: USER_ID, email: "x@example.com" },
        method,
        path,
      });

      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      try {
        await guard.canActivate(ctx);
        throw new Error("expected canActivate to reject");
      } catch (err) {
        expect((err as ForbiddenException).getResponse()).toEqual(
          expect.objectContaining({ code: "PASSWORD_CHANGE_REQUIRED" }),
        );
      }
    },
  );

  it("does NOT block POST /auth/devices/device-1/unlock — it is unauthenticated (@Public()), so req.user is never set for it in the first place", async () => {
    // The unlock route never reaches this guard's blocking branch at all:
    // BetterAuthGuard's @Public() short-circuit means req.user is undefined
    // by the time ForcePasswordChangeGuard runs, matching every other
    // @Public() route (see the "no-op when req.user is undefined" test
    // above). Documented here explicitly since it's the one device route
    // that must stay reachable with no session at all.
    const ctx = makeContext({
      user: undefined,
      method: "POST",
      path: "/auth/devices/device-1/unlock",
    });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
