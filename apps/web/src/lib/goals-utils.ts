import type { CreateGoalDto, UpdateGoalDto } from "@wealthme/contracts";

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
