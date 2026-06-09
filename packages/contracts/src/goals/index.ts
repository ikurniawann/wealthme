export type GoalStatus = "on_track" | "needs_boost" | "achieved" | "at_risk";

export interface GoalDto {
  id: string;
  name: string;
  icon: string | null;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  autoDebitAmount: number | null;
  status: GoalStatus;
  progressPercent: number;
  remainingAmount: number;
}

export interface CreateGoalDto {
  name: string;
  icon?: string;
  targetAmount: number;
  targetDate?: string;
  autoDebitAmount?: number;
}

export interface UpdateGoalDto {
  name?: string;
  icon?: string;
  targetAmount?: number;
  currentAmount?: number;
  targetDate?: string;
  autoDebitAmount?: number;
}
