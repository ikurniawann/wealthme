// Client-only "has this user seen the onboarding tour" flag.
// Mirrors the loadSettings() localStorage idiom in app/(app)/akun/page.tsx.
//
// Scoped per userId (not a single global key) — a browser that already
// dismissed the tour for one account must still show it to the next
// account that registers/signs in on that same device.

const ONBOARDED_KEY_PREFIX = "wealthme_onboarded_";

export function isOnboarded(userId: string): boolean {
  if (!userId || typeof window === "undefined") return true;
  try {
    return localStorage.getItem(ONBOARDED_KEY_PREFIX + userId) === "1";
  } catch {
    return true;
  }
}

export function setOnboarded(userId: string): void {
  if (!userId || typeof window === "undefined") return;
  try {
    localStorage.setItem(ONBOARDED_KEY_PREFIX + userId, "1");
  } catch {
    // private browsing / storage disabled — non-fatal, tour just re-shows
  }
}
