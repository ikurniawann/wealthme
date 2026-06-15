import type { CreateGoalDto } from "@wealthme/contracts";

function parseAmount(raw: string): number {
  return parseInt(raw.replace(/\./g, "").replace(/\D/g, "") || "0", 10);
}

export function parseGoalFormValues(
  values: Record<string, string>,
): CreateGoalDto & { currentAmount: number } {
  const payload: CreateGoalDto & { currentAmount: number } = {
    name: values.nama ?? "",
    targetAmount: parseAmount(values.target ?? ""),
    currentAmount: parseAmount(values.terkumpul ?? ""),
  };

  if (values.icon) payload.icon = values.icon;
  if (values.deadline) payload.targetDate = values.deadline;
  if (values.autodebit) payload.autoDebitAmount = parseAmount(values.autodebit);

  return payload;
}
