// EPIC-023 D2 (US-FAM-13, D7) — localStorage read/write for the client-bound
// `deviceId`/`deviceSecret` pair. Namespaced per userId so switching accounts
// on the same browser never accidentally reuses one user's device binding
// for another — "a new device needs the password again" also applies the
// moment the previously-signed-in user differs from the one now on screen.
//
// `deviceSecret` is 32+ random bytes generated SERVER-side at registration
// (`POST /auth/devices`) and returned to the client exactly once; this file
// only persists/reads it, it never generates it — see
// `apps/api/src/devices/devices.service.ts#registerDevice`.
const STORAGE_PREFIX = "wm.device";

export type StoredDevice = {
  deviceId: string;
  deviceSecret: string;
};

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}.${userId}`;
}

export function readStoredDevice(userId: string): StoredDevice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredDevice>;
    if (
      typeof parsed.deviceId !== "string" ||
      typeof parsed.deviceSecret !== "string"
    ) {
      return null;
    }
    return { deviceId: parsed.deviceId, deviceSecret: parsed.deviceSecret };
  } catch {
    return null;
  }
}

export function writeStoredDevice(userId: string, device: StoredDevice): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(device));
}

export function clearStoredDevice(userId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey(userId));
}

/**
 * Best-effort scan for ANY stored device binding on this browser, used only
 * to decide whether to show the PIN pad before login (no user is known yet
 * at that point — there is no session). Returns the first match; a browser
 * with multiple accounts' bindings is a rare edge case this app does not
 * need to disambiguate up front — picking the PIN pad path still always
 * falls through to "use password instead" on any mismatch.
 */
export function readAnyStoredDevice(): StoredDevice | null {
  if (typeof window === "undefined") return null;
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key?.startsWith(`${STORAGE_PREFIX}.`)) continue;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Partial<StoredDevice>;
      if (
        typeof parsed.deviceId === "string" &&
        typeof parsed.deviceSecret === "string"
      ) {
        return { deviceId: parsed.deviceId, deviceSecret: parsed.deviceSecret };
      }
    } catch {
      continue;
    }
  }
  return null;
}
