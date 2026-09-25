export type BudgetPeriod = "monthly" | "weekly" | "yearly";

/** EPIC-017: a budget's COA budget type, resolved via its category's COA account. */
export type BudgetType = "FIXED" | "VARIABLE" | "REIMBURSEMENT";

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
  // EPIC-017: FIXED / VARIABLE / REIMBURSEMENT from the category's COA account
  // (null when that COA account has no budgetType set).
  budgetType: BudgetType | null;
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
