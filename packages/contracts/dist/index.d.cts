import { z } from 'zod';

/** Rupiah amounts are stored as whole-rupiah integers (no minor unit). */
declare const RupiahSchema: z.ZodNumber;
type Rupiah = z.infer<typeof RupiahSchema>;
declare const CONTRACTS_VERSION: "0.0.0";

declare const LoginInputSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
type LoginInput = z.infer<typeof LoginInputSchema>;
declare const AuthUserSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    id: string;
    name: string;
}, {
    email: string;
    id: string;
    name: string;
}>;
type AuthUser = z.infer<typeof AuthUserSchema>;

type BudgetPeriod = 'monthly' | 'weekly' | 'yearly';
interface BudgetDto {
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
interface CreateBudgetDto {
    categoryId: string;
    period: BudgetPeriod;
    limitAmount: number;
}
interface UpdateBudgetDto {
    limitAmount?: number;
    period?: BudgetPeriod;
}

export { type AuthUser, AuthUserSchema, type BudgetDto, type BudgetPeriod, CONTRACTS_VERSION, type CreateBudgetDto, type LoginInput, LoginInputSchema, type Rupiah, RupiahSchema, type UpdateBudgetDto };
