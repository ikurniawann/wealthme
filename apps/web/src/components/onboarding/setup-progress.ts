// Client-only "how far did this user get through the guided first setup"
// state. Mirrors the isOnboarded()/setOnboarded() localStorage idiom in
// use-onboarded.ts, but tracked separately: "has this user dismissed the
// welcome dialog" and "how far through the real-data setup did they get"
// are independent questions (EPIC-023 Task H3, D22).
//
// Every id this records points at a REAL row (an account, a category, a
// budget) the user can already see, edit, or delete on its own page — so
// losing this progress (private browsing, cleared storage) never leaves an
// invisible or undoable half-state. It only means the wizard restarts from
// step one the next time it opens; nothing already created is at risk.

export type SetupStep = "account" | "budget" | "transaction" | "done";

export type SetupProgress = {
  step: SetupStep;
  accountId?: string;
  accountName?: string;
  categoryId?: string;
  categoryName?: string;
  budgetId?: string;
  limitAmount?: number;
};

const SETUP_PROGRESS_KEY_PREFIX = "wealthme_setup_progress_";

export function getSetupProgress(userId: string): SetupProgress | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SETUP_PROGRESS_KEY_PREFIX + userId);
    if (!raw) return null;
    return JSON.parse(raw) as SetupProgress;
  } catch {
    return null;
  }
}

export function setSetupProgress(
  userId: string,
  progress: SetupProgress,
): void {
  if (!userId || typeof window === "undefined") return;
  try {
    localStorage.setItem(
      SETUP_PROGRESS_KEY_PREFIX + userId,
      JSON.stringify(progress),
    );
  } catch {
    // private browsing / storage disabled — non-fatal, setup just restarts
  }
}

export function clearSetupProgress(userId: string): void {
  if (!userId || typeof window === "undefined") return;
  try {
    localStorage.removeItem(SETUP_PROGRESS_KEY_PREFIX + userId);
  } catch {
    // non-fatal
  }
}
