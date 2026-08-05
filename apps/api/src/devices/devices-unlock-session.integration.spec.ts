/**
 * EPIC-023 D2 (US-FAM-13, D7) — integration-shaped proof that the `BaSession`
 * row `DevicesService#unlock` mints is genuinely readable by the REAL
 * `BetterAuthGuard`, not a shape-only mock. Both classes are real; only the
 * datastore is faked, as an in-memory `Map` that both classes read/write
 * through the exact same Prisma-shaped surface each one actually calls
 * (`device.*`, `member.findFirst`, `baSession.create` for the service;
 * `baSession.findUnique` for the guard). If the guard's lookup shape or the
 * service's write shape ever drift apart, this test — not just each class's
 * isolated unit tests — is what catches it.
 */
import { UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import * as argon2 from "argon2";

import { BetterAuthGuard } from "../auth/guards/better-auth.guard";

import { DevicesService } from "./devices.service";

import type { ExecutionContext } from "@nestjs/common";

const USER_ID = "user-integration-1";
const DEVICE_ID = "device-integration-1";

type FakeSessionRow = {
  token: string;
  userId: string;
  familyGroupId: string | null;
  expiresAt: Date;
};

type FakeDeviceRow = {
  id: string;
  userId: string;
  deviceSecretHash: string;
  pinHash: string | null;
  failedPinAttempts: number;
  lockedUntil: Date | null;
  label: string | null;
  createdAt: Date;
  lastUsedAt: Date;
};

function buildSharedFakeStore() {
  const devices = new Map<string, FakeDeviceRow>();
  const sessions = new Map<string, FakeSessionRow>();

  const prisma = {
    device: {
      findUnique: jest.fn(({ where: { id } }: { where: { id: string } }) =>
        Promise.resolve(devices.get(id) ?? null),
      ),
      update: jest.fn(
        ({
          where: { id },
          data,
        }: {
          where: { id: string };
          data: Partial<FakeDeviceRow>;
        }) => {
          const existing = devices.get(id);
          if (!existing) throw new Error("device not found in fake store");
          const updated = { ...existing, ...data };
          devices.set(id, updated);
          return Promise.resolve(updated);
        },
      ),
    },
    member: {
      findFirst: jest.fn(() =>
        Promise.resolve({ familyGroupId: "fg-integration-1" }),
      ),
    },
    baSession: {
      create: jest.fn(({ data }: { data: FakeSessionRow }) => {
        sessions.set(data.token, data);
        return Promise.resolve(data);
      }),
      findUnique: jest.fn(
        ({ where: { token } }: { where: { token: string } }) =>
          Promise.resolve(
            sessions.has(token)
              ? { ...sessions.get(token)!, user: { email: "member@invalid" } }
              : null,
          ),
      ),
    },
  };

  return { prisma, devices };
}

function buildRequestContext(
  headers: Record<string, string>,
): ExecutionContext {
  const request = { headers, user: undefined as unknown };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => (): void => {},
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

describe("DevicesService.unlock -> BetterAuthGuard (integration-shaped, EPIC-023 D2)", () => {
  it("a token minted by unlock() is genuinely accepted by the REAL BetterAuthGuard", async () => {
    const { prisma, devices } = buildSharedFakeStore();
    const deviceSecret = "the-real-device-secret-1234567890";
    const pin = "482913";

    devices.set(DEVICE_ID, {
      id: DEVICE_ID,
      userId: USER_ID,
      deviceSecretHash: await argon2.hash(deviceSecret, {
        type: argon2.argon2id,
      }),
      pinHash: await argon2.hash(pin, { type: argon2.argon2id }),
      failedPinAttempts: 0,
      lockedUntil: null,
      label: null,
      createdAt: new Date(),
      lastUsedAt: new Date(),
    });

    const service = new DevicesService(prisma as never);
    const { token } = await service.unlock(DEVICE_ID, { deviceSecret, pin });

    // Reflector with no metadata registered — @Public() is not applied to
    // this ad-hoc handler, so the guard runs its REAL token-lookup path.
    const guard = new BetterAuthGuard(prisma as never, new Reflector());
    const ctx = buildRequestContext({ authorization: `Bearer ${token}` });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);

    const req = ctx.switchToHttp().getRequest<{
      user?: { sub: string; email: string };
    }>();
    expect(req.user).toEqual({ sub: USER_ID, email: "member@invalid" });
  }, 15000);

  it("a RANDOM/forged token is genuinely rejected by the REAL BetterAuthGuard", async () => {
    const { prisma } = buildSharedFakeStore();
    const guard = new BetterAuthGuard(prisma as never, new Reflector());
    const ctx = buildRequestContext({
      authorization: "Bearer totally-forged-token-not-in-the-store",
    });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
