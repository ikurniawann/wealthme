// EPIC-016 Task K — per-user security/behavior toggle preferences.
// Same sanitize-and-default pattern as ../notifications/notification-prefs.ts
// (deliberately mirrored, not shared) — these aren't notification settings,
// they're security-adjacent behavior flags, stored in their own JSON column
// (User.securityPrefs) so they never collide with the notification-prefs
// merge/replace semantics.

export const SECURITY_PREF_KEYS = [
  // "Konfirmasi Transaksi Besar" toggle on /akun's Keamanan tab. Persisted
  // and real, but NOT YET enforced: the global "Tambah Transaksi" dialog
  // lives in the protected `components/shell/*` tree, so wiring an actual
  // confirm-before-large-transaction gate is out of scope here — see
  // KeamananBody's disclosure copy.
  "confirmLargeTxn",
] as const;

export type SecurityPrefKey = (typeof SECURITY_PREF_KEYS)[number];
export type SecurityPrefs = Record<SecurityPrefKey, boolean>;

// Default ON — mirrors the demo's defaultChecked toggle.
export const DEFAULT_SECURITY_PREFS: SecurityPrefs = {
  confirmLargeTxn: true,
};

/**
 * Merge a stored (untrusted) JSON value over the defaults, keeping ONLY known
 * keys and coercing values to boolean. Unknown keys dropped; non-boolean
 * values keep the default. Safe on null/anything.
 */
export function resolveSecurityPrefs(stored: unknown): SecurityPrefs {
  const result: SecurityPrefs = { ...DEFAULT_SECURITY_PREFS };
  if (stored && typeof stored === "object" && !Array.isArray(stored)) {
    for (const key of SECURITY_PREF_KEYS) {
      const value = (stored as Record<string, unknown>)[key];
      if (typeof value === "boolean") result[key] = value;
    }
  }
  return result;
}
