import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import * as argon2 from "argon2";

import { PrismaService } from "../prisma/prisma.service";

import { DevicesService } from "./devices.service";

// `argon2`'s TS/CJS-interop namespace export makes `verify`/`hash`
// non-configurable AND (in this module shape) getter-only, so neither
// `jest.spyOn` nor a direct reassignment can wrap it in-place (same
// constraint `auth.service.spec.ts` documents for this module — see its own
// `jest.mock("argon2", ...)`). Wrap with REAL delegation (via
// `jest.requireActual`) rather than that file's fully-stubbed mock, so every
// other test in this suite keeps exercising genuine argon2 hashing/verifying
// — only FIX 4's timing-oracle-symmetry test below actually reads the spy's
// call count.
jest.mock("argon2", () => {
  const actual = jest.requireActual<typeof argon2>("argon2");
  return {
    ...actual,
    verify: jest.fn(actual.verify),
  };
});

const USER_A = "user-a";
const USER_B = "user-b";
const DEVICE_ID = "device-1";

describe("DevicesService (EPIC-023 D2)", () => {
  let service: DevicesService;
  let prisma: {
    device: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    member: { findFirst: jest.Mock };
    baSession: { create: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      device: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      member: { findFirst: jest.fn() },
      baSession: { create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [DevicesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(DevicesService);
  });

  describe("registerDevice", () => {
    it("generates a raw deviceSecret and stores only its argon2 hash", async () => {
      prisma.device.create.mockResolvedValue({ id: DEVICE_ID });

      const result = await service.registerDevice(USER_A, { label: "iPhone" });

      expect(result.deviceId).toBe(DEVICE_ID);
      expect(result.deviceSecret).toMatch(/^[0-9a-f]{64}$/); // 32 bytes hex

      const createArgs = prisma.device.create.mock.calls[0][0] as {
        data: { userId: string; deviceSecretHash: string; label?: string };
      };
      expect(createArgs.data.userId).toBe(USER_A);
      expect(createArgs.data.deviceSecretHash).not.toBe(result.deviceSecret);
      // The stored hash genuinely verifies the returned raw secret (real
      // argon2, not mocked).
      await expect(
        argon2.verify(createArgs.data.deviceSecretHash, result.deviceSecret),
      ).resolves.toBe(true);
    }, 15000);
  });

  describe("listDevices", () => {
    it("never includes deviceSecretHash or pinHash in the returned rows", async () => {
      prisma.device.findMany.mockResolvedValue([
        {
          id: DEVICE_ID,
          label: "iPhone",
          pinHash: "some-argon2-hash",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          lastUsedAt: new Date("2026-01-02T00:00:00.000Z"),
        },
      ]);

      const result = await service.listDevices(USER_A);

      expect(result).toEqual([
        {
          id: DEVICE_ID,
          label: "iPhone",
          hasPinSet: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          lastUsedAt: "2026-01-02T00:00:00.000Z",
        },
      ]);
      // Structural proof, not just "we didn't select it this time": no key
      // in the returned object could ever carry a hash.
      for (const row of result) {
        expect(Object.keys(row)).not.toContain("deviceSecretHash");
        expect(Object.keys(row)).not.toContain("pinHash");
      }
    });

    it("reports hasPinSet: false when pinHash is null", async () => {
      prisma.device.findMany.mockResolvedValue([
        {
          id: DEVICE_ID,
          label: null,
          pinHash: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          lastUsedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]);

      const result = await service.listDevices(USER_A);
      expect(result[0]?.hasPinSet).toBe(false);
    });
  });

  describe("setPin — ownership discipline", () => {
    it("404s (not 403) when the device belongs to a DIFFERENT user (IDOR)", async () => {
      prisma.device.findUnique.mockResolvedValue({
        id: DEVICE_ID,
        userId: USER_B,
      });

      await expect(
        service.setPin(USER_A, DEVICE_ID, { pin: "482913" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.device.update).not.toHaveBeenCalled();
    });

    it("404s when the device does not exist at all", async () => {
      prisma.device.findUnique.mockResolvedValue(null);

      await expect(
        service.setPin(USER_A, DEVICE_ID, { pin: "482913" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("sets a genuinely-verifying argon2 PIN hash for the OWNING user", async () => {
      prisma.device.findUnique.mockResolvedValue({
        id: DEVICE_ID,
        userId: USER_A,
      });

      await service.setPin(USER_A, DEVICE_ID, { pin: "482913" });

      expect(prisma.device.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: DEVICE_ID } }),
      );
      const updateArgs = prisma.device.update.mock.calls[0][0] as {
        data: { pinHash: string };
      };
      await expect(
        argon2.verify(updateArgs.data.pinHash, "482913"),
      ).resolves.toBe(true);
    }, 15000);
  });

  describe("revokeDevice — ownership discipline", () => {
    it("404s when revoking a device owned by a DIFFERENT user", async () => {
      prisma.device.findUnique.mockResolvedValue({
        id: DEVICE_ID,
        userId: USER_B,
      });

      await expect(
        service.revokeDevice(USER_A, DEVICE_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.device.delete).not.toHaveBeenCalled();
    });

    it("deletes a device owned by the requesting user", async () => {
      prisma.device.findUnique.mockResolvedValue({
        id: DEVICE_ID,
        userId: USER_A,
      });

      await service.revokeDevice(USER_A, DEVICE_ID);
      expect(prisma.device.delete).toHaveBeenCalledWith({
        where: { id: DEVICE_ID },
      });
    });
  });

  describe("unlock — the adversarial core", () => {
    async function makeDevice(overrides: {
      deviceSecret: string;
      pin: string | null;
      failedPinAttempts?: number;
      lockedUntil?: Date | null;
    }) {
      const deviceSecretHash = await argon2.hash(overrides.deviceSecret, {
        type: argon2.argon2id,
      });
      const pinHash = overrides.pin
        ? await argon2.hash(overrides.pin, { type: argon2.argon2id })
        : null;
      return {
        id: DEVICE_ID,
        userId: USER_A,
        deviceSecretHash,
        pinHash,
        failedPinAttempts: overrides.failedPinAttempts ?? 0,
        lockedUntil: overrides.lockedUntil ?? null,
        label: null,
        createdAt: new Date(),
        lastUsedAt: new Date(),
      };
    }

    it("REJECTS a correct PIN with the WRONG deviceSecret — PIN alone never unlocks anything", async () => {
      const device = await makeDevice({
        deviceSecret: "the-real-device-secret",
        pin: "482913",
      });
      prisma.device.findUnique.mockResolvedValue(device);
      prisma.device.update.mockResolvedValue(device);

      await expect(
        service.unlock(DEVICE_ID, {
          deviceSecret: "totally-wrong-secret",
          pin: "482913",
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.baSession.create).not.toHaveBeenCalled();
    }, 15000);

    it("REJECTS the correct deviceSecret with the WRONG pin", async () => {
      const device = await makeDevice({
        deviceSecret: "the-real-device-secret",
        pin: "482913",
      });
      prisma.device.findUnique.mockResolvedValue(device);
      prisma.device.update.mockResolvedValue(device);

      await expect(
        service.unlock(DEVICE_ID, {
          deviceSecret: "the-real-device-secret",
          pin: "000000",
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.baSession.create).not.toHaveBeenCalled();
    }, 15000);

    it("REJECTS when no PIN has ever been set on the device", async () => {
      const device = await makeDevice({
        deviceSecret: "the-real-device-secret",
        pin: null,
      });
      prisma.device.findUnique.mockResolvedValue(device);
      prisma.device.update.mockResolvedValue(device);

      await expect(
        service.unlock(DEVICE_ID, {
          deviceSecret: "the-real-device-secret",
          pin: "482913",
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }, 15000);

    it("REJECTS an unknown deviceId with the same generic error (no enumeration signal)", async () => {
      prisma.device.findUnique.mockResolvedValue(null);

      await expect(
        service.unlock("does-not-exist", {
          deviceSecret: "whatever",
          pin: "482913",
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.baSession.create).not.toHaveBeenCalled();
    });

    // EPIC-023 D2 fix — MEDIUM (adversarial-reviewer) — FIX 4. Before this
    // fix, an unknown deviceId returned immediately with ZERO argon2.verify
    // calls, while a known device with wrong credentials always called
    // argon2.verify (a deliberately slow op) at least once — a reliable
    // response-timing side channel for enumerating valid deviceIds. This
    // does not assert wall-clock timing (flaky in CI); it proves the code
    // PATH is symmetric by spying on argon2.verify itself and asserting
    // both paths invoke it the same number of times.
    it("invokes argon2.verify the SAME number of times for an unknown deviceId as for a known device with wrong credentials (timing-oracle symmetry)", async () => {
      const verifyMock = argon2.verify as jest.Mock;

      // Path A — unknown deviceId.
      prisma.device.findUnique.mockResolvedValueOnce(null);
      verifyMock.mockClear();
      await expect(
        service.unlock("does-not-exist", {
          deviceSecret: "whatever",
          pin: "482913",
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      const unknownDeviceVerifyCalls = verifyMock.mock.calls.length;

      // Path B — known device, wrong deviceSecret (pinHash absent so only
      // the deviceSecret verify runs, matching the single dummy verify done
      // for the unknown-device path).
      const device = await makeDevice({
        deviceSecret: "the-real-device-secret",
        pin: null,
      });
      prisma.device.findUnique.mockResolvedValueOnce(device);
      prisma.device.update.mockResolvedValue(device);
      verifyMock.mockClear();
      await expect(
        service.unlock(DEVICE_ID, {
          deviceSecret: "wrong-secret",
          pin: "482913",
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      const wrongCredentialsVerifyCalls = verifyMock.mock.calls.length;

      expect(unknownDeviceVerifyCalls).toBeGreaterThan(0);
      expect(unknownDeviceVerifyCalls).toBe(wrongCredentialsVerifyCalls);
    }, 15000);

    it("mints a REAL BaSession row and returns its token on a genuinely correct unlock", async () => {
      const device = await makeDevice({
        deviceSecret: "the-real-device-secret",
        pin: "482913",
      });
      prisma.device.findUnique.mockResolvedValue(device);
      prisma.device.update.mockResolvedValue(device);
      prisma.member.findFirst.mockResolvedValue({ familyGroupId: "fg-1" });
      prisma.baSession.create.mockResolvedValue({});

      const result = await service.unlock(DEVICE_ID, {
        deviceSecret: "the-real-device-secret",
        pin: "482913",
      });

      expect(result.token).toMatch(/^[a-zA-Z0-9]{32}$/);
      expect(prisma.baSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            token: result.token,
            userId: USER_A,
            familyGroupId: "fg-1",
          }),
        }),
      );
      // Resets the failure counter on success.
      expect(prisma.device.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: DEVICE_ID },
          data: expect.objectContaining({
            failedPinAttempts: 0,
            lockedUntil: null,
          }),
        }),
      );
    }, 15000);

    it("LOCKS OUT after crossing the failure threshold and BLOCKS further attempts even with the correct credentials", async () => {
      const device = await makeDevice({
        deviceSecret: "the-real-device-secret",
        pin: "482913",
        failedPinAttempts: 4, // one more failure crosses the threshold of 5
      });
      prisma.device.findUnique.mockResolvedValue(device);
      // EPIC-023 D2 fix (FIX 3) — registerFailedAttempt now issues TWO
      // update() calls on the crossing-threshold path: first an atomic
      // `{ increment: 1 }`, then (only if the returned row crossed the
      // threshold) a second call resetting the counter + setting
      // lockedUntil. Simulate the atomic increment's real DB semantics —
      // the mock must return the POST-increment row, exactly like Prisma's
      // real `update()` does, since the service reads the threshold off
      // this return value (not off the stale `device` it was called with).
      prisma.device.update.mockImplementation(
        (args: { data: { failedPinAttempts?: { increment: number } } }) => {
          if (args.data.failedPinAttempts?.increment !== undefined) {
            return Promise.resolve({
              ...device,
              failedPinAttempts:
                device.failedPinAttempts +
                args.data.failedPinAttempts.increment,
            });
          }
          return Promise.resolve(device);
        },
      );

      // 5th consecutive failure — crosses MAX_FAILED_PIN_ATTEMPTS (5).
      await expect(
        service.unlock(DEVICE_ID, {
          deviceSecret: "wrong-secret",
          pin: "482913",
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      // First call: the atomic increment.
      const incrementArgs = prisma.device.update.mock.calls[0][0] as {
        data: { failedPinAttempts: { increment: number } };
      };
      expect(incrementArgs.data.failedPinAttempts).toEqual({ increment: 1 });

      // Second call: the lockout write, made only because the FIRST call's
      // OWN return value (the atomically-updated row) crossed the
      // threshold.
      const lockoutArgs = prisma.device.update.mock.calls[1][0] as {
        data: { failedPinAttempts: number; lockedUntil: Date | null };
      };
      expect(lockoutArgs.data.failedPinAttempts).toBe(0);
      expect(lockoutArgs.data.lockedUntil).toBeInstanceOf(Date);
      expect(lockoutArgs.data.lockedUntil!.getTime()).toBeGreaterThan(
        Date.now(),
      );

      // Simulate the DB state after the lock was written, then retry with
      // the GENUINELY correct credentials — must still be refused while
      // locked.
      const lockedDevice = {
        ...device,
        lockedUntil: lockoutArgs.data.lockedUntil,
      };
      prisma.device.findUnique.mockResolvedValue(lockedDevice);

      await expect(
        service.unlock(DEVICE_ID, {
          deviceSecret: "the-real-device-secret",
          pin: "482913",
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.baSession.create).not.toHaveBeenCalled();
    }, 15000);

    it("does NOT cross the lockout threshold on a single failure below it (increment-only path)", async () => {
      // A single wrong attempt starting from 0 must issue ONLY the atomic
      // increment call — no second lockout-write call — proving the
      // threshold check correctly reads the post-increment count and
      // doesn't over-trigger.
      const device = await makeDevice({
        deviceSecret: "the-real-device-secret",
        pin: "482913",
        failedPinAttempts: 0,
      });
      prisma.device.findUnique.mockResolvedValue(device);
      prisma.device.update.mockImplementation(
        (args: { data: { failedPinAttempts?: { increment: number } } }) => {
          if (args.data.failedPinAttempts?.increment !== undefined) {
            return Promise.resolve({
              ...device,
              failedPinAttempts:
                device.failedPinAttempts +
                args.data.failedPinAttempts.increment,
            });
          }
          return Promise.resolve(device);
        },
      );

      await expect(
        service.unlock(DEVICE_ID, {
          deviceSecret: "wrong-secret",
          pin: "482913",
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(prisma.device.update).toHaveBeenCalledTimes(1);
      const incrementArgs = prisma.device.update.mock.calls[0][0] as {
        data: { failedPinAttempts: { increment: number } };
      };
      expect(incrementArgs.data.failedPinAttempts).toEqual({ increment: 1 });
      // Deterministic anti-regression teeth (adversarial-reviewer round 2):
      // the atomic path loads the device exactly ONCE (at the top of
      // unlock) and never re-reads the counter — registerFailedAttempt gets
      // the device by param and only issues the `{ increment: 1 }` update.
      // A read-then-write regression would call findUnique a SECOND time to
      // fetch a fresh count before computing `+1`, so a call count of 1
      // fails deterministically against that regression class without
      // depending on a race the fake Prisma can't reproduce.
      expect(prisma.device.findUnique).toHaveBeenCalledTimes(1);
    }, 15000);

    // EPIC-023 D2 fix — MEDIUM (adversarial-reviewer, mutation testing) —
    // FIX 3. The old implementation read `device.failedPinAttempts`,
    // computed `+1` in application code, then wrote the computed value
    // back — NOT atomic. This proves the fix genuinely closes the race: N
    // concurrent wrong-credential unlock attempts against the SAME device
    // must net exactly N increments, not fewer from a lost update.
    //
    // Mechanism: a shared in-memory fake row plus a fake Prisma `update`
    // that applies `{ increment: N }` the way a real database does —
    // reading the CURRENT value and adding to it inside a single
    // synchronous step per call (no interleaved read-then-write window).
    // If DevicesService ever regresses to computing `count + 1` in
    // application code from a value it read earlier (i.e. stops passing
    // Prisma's atomic increment operator and instead passes a plain
    // number), this fake can no longer be trusted to "self-heal" the race
    // for it — the assertion below is on the FINAL counter value, which
    // only lands on exactly 5 if every one of the 5 concurrent calls
    // genuinely applied its own atomic increment.
    it("nets exactly N increments for N concurrent failed unlock attempts against the same device (no lost update)", async () => {
      const CONCURRENT_ATTEMPTS = 5;
      const device = await makeDevice({
        deviceSecret: "the-real-device-secret",
        pin: "482913",
        failedPinAttempts: 0,
      });

      // Shared mutable fake row — every concurrent unlock() call reads and
      // writes THIS single object, the same way concurrent requests would
      // hit the same DB row.
      const fakeRow = { ...device };
      prisma.device.findUnique.mockImplementation(() =>
        Promise.resolve({ ...fakeRow }),
      );
      prisma.device.update.mockImplementation(
        (args: {
          data: {
            failedPinAttempts?: { increment: number } | number;
            lockedUntil?: Date | null;
          };
        }) => {
          const inc = args.data.failedPinAttempts;
          if (inc !== null && typeof inc === "object" && "increment" in inc) {
            // Atomic: apply directly to the shared row, no separate read.
            fakeRow.failedPinAttempts += inc.increment;
          } else if (typeof inc === "number") {
            fakeRow.failedPinAttempts = inc;
          }
          if ("lockedUntil" in args.data) {
            fakeRow.lockedUntil = args.data.lockedUntil ?? null;
          }
          return Promise.resolve({ ...fakeRow });
        },
      );

      // Fire CONCURRENT_ATTEMPTS wrong-credential unlock attempts at once —
      // MAX_FAILED_PIN_ATTEMPTS is 5, so this exactly reaches (but the
      // implementation resets to 0 once locked, hence asserting on the
      // lockedUntil having been set rather than a raw counter value, which
      // is the observable proof the full count was honored).
      const results = await Promise.allSettled(
        Array.from({ length: CONCURRENT_ATTEMPTS }, () =>
          service.unlock(DEVICE_ID, {
            deviceSecret: "wrong-secret",
            pin: "482913",
          }),
        ),
      );

      // Every attempt must have failed (wrong secret).
      expect(results.every((r) => r.status === "rejected")).toBe(true);

      // If the increment were lost (non-atomic read-then-write), 5
      // concurrent calls reading the same starting value would net fewer
      // than 5 real increments and the lockout would never engage. Genuine
      // atomicity means all 5 are honored and the threshold is crossed,
      // which the service observes by resetting the counter to 0 AND
      // setting lockedUntil.
      expect(fakeRow.lockedUntil).not.toBeNull();
      expect(fakeRow.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
      expect(fakeRow.failedPinAttempts).toBe(0);

      // Deterministic teeth (adversarial-reviewer round 2): the fake Prisma
      // serializes calls under jest's single-threaded loop, so the
      // final-count assertions above cannot by themselves distinguish
      // atomic from read-then-write. These call-shape assertions can, with
      // no dependence on a race: each unlock() loads the device exactly
      // once, so N concurrent attempts do exactly N findUnique calls — a
      // read-then-write regression that re-reads the counter inside the
      // failure path would do 2N. And every counter mutation must use the
      // atomic `{ increment: 1 }` operator, never a pre-computed literal.
      expect(prisma.device.findUnique).toHaveBeenCalledTimes(
        CONCURRENT_ATTEMPTS,
      );
      const incrementUpdates = prisma.device.update.mock.calls.filter(
        (c) =>
          (c[0] as { data: { failedPinAttempts?: unknown } }).data
            .failedPinAttempts !== undefined &&
          typeof (c[0] as { data: { failedPinAttempts?: unknown } }).data
            .failedPinAttempts === "object",
      );
      expect(incrementUpdates.length).toBe(CONCURRENT_ATTEMPTS);
      for (const call of incrementUpdates) {
        expect(
          (call[0] as { data: { failedPinAttempts: unknown } }).data
            .failedPinAttempts,
        ).toEqual({ increment: 1 });
      }
    }, 15000);

    it("ALLOWS unlock again once the lockout window has expired", async () => {
      const device = await makeDevice({
        deviceSecret: "the-real-device-secret",
        pin: "482913",
        lockedUntil: new Date(Date.now() - 1000), // expired 1s ago
      });
      prisma.device.findUnique.mockResolvedValue(device);
      prisma.device.update.mockResolvedValue(device);
      prisma.member.findFirst.mockResolvedValue({ familyGroupId: "fg-1" });
      prisma.baSession.create.mockResolvedValue({});

      const result = await service.unlock(DEVICE_ID, {
        deviceSecret: "the-real-device-secret",
        pin: "482913",
      });

      expect(result.token).toBeDefined();
      expect(prisma.baSession.create).toHaveBeenCalled();
    }, 15000);

    it("a device registered by user A cannot be unlocked using an unrelated user's guess of A's PIN alone", async () => {
      // Cross-user unlock is not actually gated by the requester's identity
      // (there is no session yet), it is gated by possession of the exact
      // deviceSecret. This proves guessing/knowing the PIN without the
      // secret — regardless of who is attempting it — never succeeds.
      const device = await makeDevice({
        deviceSecret: "user-a-real-secret",
        pin: "482913",
      });
      prisma.device.findUnique.mockResolvedValue(device);
      prisma.device.update.mockResolvedValue(device);

      await expect(
        service.unlock(DEVICE_ID, {
          deviceSecret: "user-b-guessed-secret",
          pin: "482913",
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.baSession.create).not.toHaveBeenCalled();
    }, 15000);
  });
});
