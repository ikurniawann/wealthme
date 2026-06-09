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

type GoalStatus = "on_track" | "needs_boost" | "achieved" | "at_risk";
interface GoalDto {
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
interface CreateGoalDto {
    name: string;
    icon?: string;
    targetAmount: number;
    targetDate?: string;
    autoDebitAmount?: number;
}
interface UpdateGoalDto {
    name?: string;
    icon?: string;
    targetAmount?: number;
    currentAmount?: number;
    targetDate?: string;
    autoDebitAmount?: number;
}

export { type AuthUser, AuthUserSchema, CONTRACTS_VERSION, type CreateGoalDto, type GoalDto, type GoalStatus, type LoginInput, LoginInputSchema, type Rupiah, RupiahSchema, type UpdateGoalDto };
