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
}

export interface UpdateGoalDto {
  name?: string;
  icon?: string;
  targetAmount?: number;
  currentAmount?: number;
  targetDate?: string;
  autoDebitAmount?: number;
  autoDebitDay?: number;
}
