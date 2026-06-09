export type BudgetPeriod = "monthly" | "weekly" | "yearly";

export interface BudgetDto {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  period: BudgetPeriod;
  limitAmount: number;
  spentAmount: number;
  remainingAmount: number;
  usagePercent: number;
  isOverBudget: boolean;
  isNearLimit: boolean;
}

export interface CreateBudgetDto {
  categoryId: string;
  period: BudgetPeriod;
  limitAmount: number;
}

export interface UpdateBudgetDto {
  limitAmount?: number;
  period?: BudgetPeriod;
}
