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

const VALID_STEPS: readonly SetupStep[] = [
  "account",
  "budget",
  "transaction",
  "done",
];

function isSetupStep(value: unknown): value is SetupStep {
  return (
    typeof value === "string" &&
    (VALID_STEPS as readonly string[]).includes(value)
  );
}

// EPIC-023 Task H fix round (MEDIUM 10) — `JSON.parse(raw) as SetupProgress`
// was a bare cast: a `step` outside the union (corrupt storage, an older
// build's shape, manual tampering) passed the `!== "done"` check in
// guided-setup.tsx and matched no render branch, producing a dialog with a
// header and a blank body. Validate every field's runtime type and fall
// back to the first step ("account") instead of trusting the cast.
export function getSetupProgress(userId: string): SetupProgress | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SETUP_PROGRESS_KEY_PREFIX + userId);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as Record<string, unknown>;
    return {
      step: isSetupStep(candidate.step) ? candidate.step : "account",
      accountId:
        typeof candidate.accountId === "string"
          ? candidate.accountId
          : undefined,
      accountName:
        typeof candidate.accountName === "string"
          ? candidate.accountName
          : undefined,
      categoryId:
        typeof candidate.categoryId === "string"
          ? candidate.categoryId
          : undefined,
      categoryName:
        typeof candidate.categoryName === "string"
          ? candidate.categoryName
          : undefined,
      budgetId:
        typeof candidate.budgetId === "string" ? candidate.budgetId : undefined,
      limitAmount:
        typeof candidate.limitAmount === "number"
          ? candidate.limitAmount
          : undefined,
    };
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
