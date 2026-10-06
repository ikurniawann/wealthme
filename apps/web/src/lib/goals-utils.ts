import type {
  CreateGoalDto,
  GoalDto,
  UpdateGoalDto,
} from "@wealthme/contracts";

function parseAmount(raw: string): number {
  return parseInt(raw.replace(/\./g, "").replace(/\D/g, "") || "0", 10);
}

type GoalFormPayload = CreateGoalDto &
  Partial<Pick<UpdateGoalDto, "currentAmount">>;

/**
 * EPIC-022 A4 — `values.terkumpul` (currentAmount) is always present in the
 * CRUD form's values, even when the user never touched the "Sudah
 * Terkumpul" field, because `initialFieldValues` (crud-modal.tsx) seeds
 * every field with a string. Unconditionally sending it on every PATCH used
 * to 400 every edit of a freshly-created goal (currentAmount is 0, and the
 * API rejected 0 as "not positive" — that DTO check now accepts 0 too, see
 * update-goal.dto.ts). Sending it only when it actually changed from what
 * the form was seeded with is a second, independent guard: an edit that
 * never touches "Sudah Terkumpul" can't accidentally clobber it with a
 * stale re-parse. Pass `originalCurrentAmount` on an edit (omit it on
 * create, where there is no "original" yet — the field is included
 * unconditionally, matching prior behavior; the API's `CreateGoalDto` has
 * no `currentAmount` field at all, so it's silently whitelisted away).
 */
export function parseGoalFormValues(
  values: Record<string, string>,
  originalCurrentAmount?: number,
): GoalFormPayload {
  const payload: GoalFormPayload = {
    name: values.nama ?? "",
    targetAmount: parseAmount(values.target ?? ""),
  };

  if (values.icon) payload.icon = values.icon;
  if (values.deadline) payload.targetDate = values.deadline;
  if (values.autodebit) payload.autoDebitAmount = parseAmount(values.autodebit);
  // EPIC-033 group 5 — the day of month the auto-debit runs.
  if (values.autodebitDay) {
    const day = Number.parseInt(values.autodebitDay, 10);
    if (day >= 1 && day <= 28) payload.autoDebitDay = day;
  }

  const parsedCurrentAmount = parseAmount(values.terkumpul ?? "");
  if (
    originalCurrentAmount === undefined ||
    parsedCurrentAmount !== originalCurrentAmount
  ) {
    payload.currentAmount = parsedCurrentAmount;
  }

  return payload;
}

export function buildGoalBody(
  values: Record<string, string>,
  originalCurrentAmount?: number,
): string {
  return JSON.stringify(parseGoalFormValues(values, originalCurrentAmount));
}

/** Plain-language pace of a goal: the text that backs the progress bar's colour. */
export type GoalPace = "done" | "onTrack" | "late";

/**
 * Reads the pace from the API's own `status` (progress vs the straight-line
 * pace from creation to `targetDate`, recomputed on every read; see
 * `computeStatus` in the goals service) instead of a second client-side
 * formula: `achieved` or a full bar is "done", `on_track` is on plan, and
 * `needs_boost` / `at_risk` both read as "late".
 */
export function goalPace(
  goal: Pick<GoalDto, "status" | "progressPercent">,
): GoalPace {
  if (goal.status === "achieved" || goal.progressPercent >= 100) return "done";
  return goal.status === "on_track" ? "onTrack" : "late";
}
