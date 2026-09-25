import { z } from "zod";

export type GoalStatus = "on_track" | "needs_boost" | "achieved" | "at_risk";

export interface GoalDto {
  id: string;
  name: string;
  icon: string | null;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  autoDebitAmount: number | null;
  /** EPIC-033 group 5 — day of month (1-28) the auto-debit runs. */
  autoDebitDay: number | null;
  /** Revisi F — account the daily auto-debit draws from. */
  sourceAccountId: string | null;
  status: GoalStatus;
  progressPercent: number;
  remainingAmount: number;
}

export interface CreateGoalDto {
  name: string;
  icon?: string;
  targetAmount: number;
  // EPIC-022 C8 — the "Sudah Terkumpul" (already collected) amount at
  // creation; was silently discarded server-side before this.
  currentAmount?: number;
  targetDate?: string;
  autoDebitAmount?: number;
  autoDebitDay?: number;
  sourceAccountId?: string;
}

export interface UpdateGoalDto {
  name?: string;
  icon?: string;
  targetAmount?: number;
  currentAmount?: number;
  targetDate?: string;
  autoDebitAmount?: number;
  autoDebitDay?: number;
  sourceAccountId?: string;
}

export const GoalContributionSourceSchema = z.enum(["manual", "auto"]);
export type GoalContributionSource = z.infer<
  typeof GoalContributionSourceSchema
>;

export const CreateGoalContributionInputSchema = z.object({
  amount: z.string().regex(/^[1-9]\d{0,11}$/),
  accountId: z.string().uuid().optional(),
  occurredAt: z.string().datetime().optional(),
});
export type CreateGoalContributionInput = z.infer<
  typeof CreateGoalContributionInputSchema
>;

export const GoalContributionDtoSchema = z.object({
  id: z.string(),
  goalId: z.string(),
  amount: z.string(),
  accountId: z.string().nullable(),
  accountName: z.string().nullable(),
  transactionId: z.string().nullable(),
  occurredAt: z.string(),
  source: GoalContributionSourceSchema,
  createdAt: z.string(),
});
export type GoalContributionDto = z.infer<typeof GoalContributionDtoSchema>;

export interface GoalContributionResult {
  contribution: GoalContributionDto;
  goal: GoalDto;
}
