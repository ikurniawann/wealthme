// Client-only "has this user seen the onboarding tour" flag.
// Mirrors the loadSettings() localStorage idiom in app/(app)/akun/page.tsx.

const ONBOARDED_KEY = "wealthme_onboarded";

export function isOnboarded(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(ONBOARDED_KEY) === "1";
  } catch {
    return true;
  }
}

export function setOnboarded(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ONBOARDED_KEY, "1");
  } catch {
    // private browsing / storage disabled — non-fatal, tour just re-shows
  }
}
