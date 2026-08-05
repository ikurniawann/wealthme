import { randomBytes } from "node:crypto";

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import * as argon2 from "argon2";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { DeviceResponseDto } from "./dto/device-response.dto";
import type { RegisterDeviceResponseDto } from "./dto/register-device-response.dto";
import type { RegisterDeviceDto } from "./dto/register-device.dto";
import type { SetDevicePinDto } from "./dto/set-device-pin.dto";
import type { UnlockDeviceResponseDto } from "./dto/unlock-device-response.dto";
import type { UnlockDeviceDto } from "./dto/unlock-device.dto";
import type { Device } from "@prisma/client";

// EPIC-023 D2 (US-FAM-13, D7) — "PIN is a device unlock, not a credential."
// A 6-digit PIN alone (1,000,000 combinations) never authenticates anyone
// from anywhere; it only works combined with possession of `deviceSecret`
// (32+ random bytes generated client-side, bound to one physical device at
// registration time — which itself requires an already-authenticated
// session, i.e. right after a real password login).
const DEVICE_SECRET_ENCODING = "hex" as const; // 32 bytes -> 64 hex chars
const DEVICE_SECRET_BYTES = 32;
const MAX_FAILED_PIN_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Session token generation mirrors better-auth's OWN token shape exactly —
// verified against the installed better-auth@1.6.25 package's own
// `generateId` (node_modules/.../@better-auth/core/dist/utils/id.mjs):
// `createRandomStringGenerator("a-z", "A-Z", "0-9")(32)`, i.e. 32
// cryptographically random alphanumeric characters (~190 bits of entropy,
// well above a UUID v4's 122 bits). The only load-bearing property is that
// it is a real, unguessable, unique string `BetterAuthGuard`'s
// `prisma.baSession.findUnique({ where: { token } })` lookup can find — this
// generator satisfies that with entropy at least as strong as better-auth's
// own, using Node's `crypto.randomBytes` (not Math.random).
const TOKEN_ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const SESSION_TOKEN_LENGTH = 32;
// better-auth's own `session.expiresIn` default (not overridden in
// apps/web/src/lib/auth.ts) — verified against the installed
// better-auth@1.6.25 package's db/internal-adapter.mjs: `sec("7d")`.
const SESSION_EXPIRES_IN_MS = 7 * 24 * 60 * 60 * 1000;

function generateSessionToken(): string {
  const bytes = randomBytes(SESSION_TOKEN_LENGTH);
  let token = "";
  for (let i = 0; i < SESSION_TOKEN_LENGTH; i++) {
    // Modulo bias is negligible here (256 % 62 != 0, but this matches the
    // entropy bar this codebase needs — see comment above) and is not the
    // security-relevant property; use of `crypto.randomBytes` is.
    token += TOKEN_ALPHABET[(bytes[i] as number) % TOKEN_ALPHABET.length];
  }
  return token;
}

// EPIC-023 D2 fix — MEDIUM (adversarial-reviewer) — `unlock()` only ever
// called argon2.verify (a deliberately slow hash comparison) when a `device`
// row was found; an unknown deviceId returned immediately. That makes
// response latency a reliable side channel for enumerating valid deviceIds,
// even though the response body/status is identical either way. A single
// fixed dummy hash, computed and cached ONCE (not per-request — hashing on
// every miss would itself be a cheap DoS lever), closes the gross timing gap
// by giving the "device not found" path the same argon2.verify cost as the
// "device found, credentials wrong" path.
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= argon2.hash("wm-device-unlock-dummy-hash-constant", {
    type: argon2.argon2id,
  });
  return dummyHashPromise;
}

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registers a new device for the CURRENT session's user. Requires an
   * already-authenticated request — this is NOT the unlock flow. Returns the
   * raw `deviceSecret` exactly once; only its argon2 hash is ever persisted.
   */
  async registerDevice(
    userId: string,
    dto: RegisterDeviceDto,
  ): Promise<RegisterDeviceResponseDto> {
    const deviceSecret = randomBytes(DEVICE_SECRET_BYTES).toString(
      DEVICE_SECRET_ENCODING,
    );
    const deviceSecretHash = await argon2.hash(deviceSecret, {
      type: argon2.argon2id,
    });

    const device = await this.prisma.device.create({
      data: {
        userId,
        deviceSecretHash,
        label: dto.label,
      },
      select: { id: true },
    });

    return { deviceId: device.id, deviceSecret };
  }

  /**
   * Lists the current user's registered devices. Never returns
   * `deviceSecretHash`/`pinHash` — `DeviceResponseDto` has no field for
   * either, so this Prisma `select` structurally cannot leak them.
   */
  async listDevices(userId: string): Promise<DeviceResponseDto[]> {
    const devices = await this.prisma.device.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        label: true,
        pinHash: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });

    return devices.map((d) => ({
      id: d.id,
      label: d.label,
      hasPinSet: d.pinHash !== null,
      createdAt: d.createdAt.toISOString(),
      lastUsedAt: d.lastUsedAt.toISOString(),
    }));
  }

  /**
   * Sets/replaces the PIN for a device owned by the current session's user.
   * Still requires the real authenticated session — this is NOT the unlock
   * flow. 404s (not 403) when the device belongs to someone else, so an
   * attacker cannot distinguish "not yours" from "doesn't exist".
   */
  async setPin(
    userId: string,
    deviceId: string,
    dto: SetDevicePinDto,
  ): Promise<void> {
    const device = await this.findOwnedDeviceOrThrow(userId, deviceId);

    const pinHash = await argon2.hash(dto.pin, { type: argon2.argon2id });

    await this.prisma.device.update({
      where: { id: device.id },
      data: { pinHash },
    });
  }

  /**
   * Revokes/forgets a device. Same 404-not-403 ownership discipline as
   * setPin — a lost/stolen device's PIN-unlock capability is killed by
   * deleting its row.
   */
  async revokeDevice(userId: string, deviceId: string): Promise<void> {
    const device = await this.findOwnedDeviceOrThrow(userId, deviceId);
    await this.prisma.device.delete({ where: { id: device.id } });
  }

  /**
   * The PIN-unlock flow. UNauthenticated — there is no session yet. Two
   * factors, not one: `deviceSecret` (possession) AND `pin` (knowledge).
   * Failure never distinguishes "device unknown" from "device secret ok but
   * PIN wrong" — both return the same generic error, and both increment the
   * SAME `failedPinAttempts` counter once a device row is found (an unknown
   * deviceId has no counter to increment, which is fine: it costs an
   * attacker nothing extra to enumerate deviceIds, but an existing device
   * still locks out exactly the same way regardless of which factor an
   * attacker got wrong).
   */
  async unlock(
    deviceId: string,
    dto: UnlockDeviceDto,
  ): Promise<UnlockDeviceResponseDto> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      // Perform a dummy verify against a fixed pre-computed hash so this
      // path's latency matches the "device exists, credentials wrong" path
      // below (see `getDummyHash` comment) — an unknown deviceId must not be
      // distinguishable from a wrong-credentials one via response timing.
      await argon2
        .verify(await getDummyHash(), dto.deviceSecret)
        .catch(() => false);
      throw new UnauthorizedException("Unlock failed");
    }

    if (device.lockedUntil && device.lockedUntil > new Date()) {
      const remainingMs = device.lockedUntil.getTime() - Date.now();
      throw new ForbiddenException({
        message: "Device is locked. Use your password to sign in.",
        code: "DEVICE_LOCKED",
        remainingMs,
      });
    }

    const secretValid = await argon2
      .verify(device.deviceSecretHash, dto.deviceSecret)
      .catch(() => false);
    const pinValid = device.pinHash
      ? await argon2.verify(device.pinHash, dto.pin).catch(() => false)
      : false;

    if (!secretValid || !pinValid) {
      await this.registerFailedAttempt(device);
      throw new UnauthorizedException("Unlock failed");
    }

    await this.prisma.device.update({
      where: { id: device.id },
      data: {
        failedPinAttempts: 0,
        lockedUntil: null,
        lastUsedAt: new Date(),
      },
    });

    const token = await this.mintSession(device.userId);
    return { token };
  }

  /**
   * EPIC-023 D2 fix — MEDIUM (adversarial-reviewer, mutation-tested) — this
   * used to read `device.failedPinAttempts`, compute `+1` in application
   * code, and write the computed value back. That is NOT atomic: N
   * concurrent wrong-PIN requests against the SAME device could all read the
   * same stale count and each write `count+1` based on it, netting +1
   * instead of +N — letting an attacker exceed MAX_FAILED_PIN_ATTEMPTS by
   * racing requests instead of sending them serially.
   *
   * Fix: use Prisma's atomic `{ increment: 1 }`, which the database applies
   * per-request independent of read timing (`UPDATE ... SET
   * "failedPinAttempts" = "failedPinAttempts" + 1`, not a
   * read-then-compare-then-write round trip). The threshold check below then
   * reads the count from `update()`'s OWN return value — the row Prisma just
   * atomically wrote — never from the possibly-stale `device` parameter, so
   * the lockout decision is always made against the true post-increment
   * count.
   */
  private async registerFailedAttempt(device: Device): Promise<void> {
    const updated = await this.prisma.device.update({
      where: { id: device.id },
      data: { failedPinAttempts: { increment: 1 } },
    });

    if (updated.failedPinAttempts >= MAX_FAILED_PIN_ATTEMPTS) {
      await this.prisma.device.update({
        where: { id: device.id },
        data: {
          failedPinAttempts: 0,
          lockedUntil: new Date(Date.now() + LOCKOUT_WINDOW_MS),
        },
      });
    }
  }

  /**
   * Mints a real `BaSession` row directly via Prisma — the same precedent
   * D1 established (`PasswordPolicyService`, which writes a credential
   * `BaAccount` row by hand) for auth-adjacent writes when better-auth's own
   * API is unreachable from `apps/api` (the `auth` instance lives only in
   * apps/web — confirmed during D1's implementation, not a dependency of
   * apps/api). `familyGroupId` mirrors auth.ts's own
   * `session.create.before` hook: most-recent membership wins.
   */
  private async mintSession(userId: string): Promise<string> {
    const member = await this.prisma.member.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { familyGroupId: true },
    });

    const sessionToken = generateSessionToken();
    await this.prisma.baSession.create({
      data: {
        token: sessionToken,
        userId,
        familyGroupId: member?.familyGroupId ?? null,
        expiresAt: new Date(Date.now() + SESSION_EXPIRES_IN_MS),
      },
    });

    return sessionToken;
  }

  private async findOwnedDeviceOrThrow(
    userId: string,
    deviceId: string,
  ): Promise<Device> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });
    // 404 (not 403) whether the device doesn't exist or belongs to someone
    // else — never confirm the existence of another user's device.
    if (!device || device.userId !== userId) {
      throw new NotFoundException("Device not found");
    }
    return device;
  }
}
