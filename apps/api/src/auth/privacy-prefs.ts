// EPIC hardening G1 (P0 honesty) — akun Pengaturan/Privasi toggles used to be
// uncontrolled `defaultChecked` Switches that saved nothing (a privacy-trust
// breach: a user who flips "hide from family" believes it took effect).
// Mirrors notification-prefs.ts exactly: a small JSON column, a known key
// allowlist, and a resolver that merges stored values over defaults.

export const PRIVACY_PREF_KEYS = [
  // Pengaturan / data section
  "hideBalance",
  "weeklySummary",
  // Privasi tab
  "hideFromFamily",
  "screenshotProtect",
  "sendAnalytics",
  "aiPersonalization",
] as const;

export type PrivacyPrefKey = (typeof PRIVACY_PREF_KEYS)[number];
export type PrivacyPrefs = Record<PrivacyPrefKey, boolean>;

// Mirrors the demo's prior `defaultChecked` values so persisting the real
// column doesn't change any existing user's perceived default.
export const DEFAULT_PRIVACY_PREFS: PrivacyPrefs = {
  hideBalance: false,
  weeklySummary: true,
  hideFromFamily: false,
  screenshotProtect: true,
  sendAnalytics: true,
  aiPersonalization: true,
};

/**
 * Merge a stored (untrusted) JSON value over the defaults, keeping ONLY known
 * keys and coercing values to boolean. Unknown keys dropped; non-boolean
 * values keep the default. Safe on null/anything.
 */
export function resolvePrivacyPrefs(stored: unknown): PrivacyPrefs {
  const result: PrivacyPrefs = { ...DEFAULT_PRIVACY_PREFS };
  if (stored && typeof stored === "object" && !Array.isArray(stored)) {
    for (const key of PRIVACY_PREF_KEYS) {
      const value = (stored as Record<string, unknown>)[key];
      if (typeof value === "boolean") result[key] = value;
    }
  }
  return result;
}
