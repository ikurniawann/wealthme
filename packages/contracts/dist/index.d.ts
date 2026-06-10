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

type SearchResultType = "account" | "transaction" | "category";
interface SearchResultDto {
    type: SearchResultType;
    id: string;
    label: string;
    sub: string;
    href: string;
    icon: string;
}
interface SearchResponseDto {
    results: SearchResultDto[];
    query: string;
}

declare const AccountTypeSchema: z.ZodEnum<["bank", "ewallet", "cash", "investment", "property"]>;
type AccountType = z.infer<typeof AccountTypeSchema>;
declare const CreateAccountInputSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodEnum<["bank", "ewallet", "cash", "investment", "property"]>;
    institution: z.ZodOptional<z.ZodString>;
    maskedNumber: z.ZodOptional<z.ZodString>;
    balance: z.ZodNumber;
    currency: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "bank" | "ewallet" | "cash" | "investment" | "property";
    name: string;
    balance: number;
    currency: string;
    institution?: string | undefined;
    maskedNumber?: string | undefined;
}, {
    type: "bank" | "ewallet" | "cash" | "investment" | "property";
    name: string;
    balance: number;
    institution?: string | undefined;
    maskedNumber?: string | undefined;
    currency?: string | undefined;
}>;
type CreateAccountInput = z.infer<typeof CreateAccountInputSchema>;
declare const UpdateAccountInputSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["bank", "ewallet", "cash", "investment", "property"]>>;
    institution: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    maskedNumber: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    balance: z.ZodOptional<z.ZodNumber>;
    currency: z.ZodOptional<z.ZodDefault<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    type?: "bank" | "ewallet" | "cash" | "investment" | "property" | undefined;
    name?: string | undefined;
    institution?: string | undefined;
    maskedNumber?: string | undefined;
    balance?: number | undefined;
    currency?: string | undefined;
}, {
    type?: "bank" | "ewallet" | "cash" | "investment" | "property" | undefined;
    name?: string | undefined;
    institution?: string | undefined;
    maskedNumber?: string | undefined;
    balance?: number | undefined;
    currency?: string | undefined;
}>;
type UpdateAccountInput = z.infer<typeof UpdateAccountInputSchema>;
declare const AccountDtoSchema: z.ZodObject<{
    id: z.ZodString;
    familyGroupId: z.ZodString;
    name: z.ZodString;
    type: z.ZodEnum<["bank", "ewallet", "cash", "investment", "property"]>;
    institution: z.ZodNullable<z.ZodString>;
    maskedNumber: z.ZodNullable<z.ZodString>;
    balance: z.ZodString;
    currency: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "bank" | "ewallet" | "cash" | "investment" | "property";
    id: string;
    name: string;
    institution: string | null;
    maskedNumber: string | null;
    balance: string;
    currency: string;
    familyGroupId: string;
    createdAt: string;
    updatedAt: string;
}, {
    type: "bank" | "ewallet" | "cash" | "investment" | "property";
    id: string;
    name: string;
    institution: string | null;
    maskedNumber: string | null;
    balance: string;
    currency: string;
    familyGroupId: string;
    createdAt: string;
    updatedAt: string;
}>;
type AccountDto = z.infer<typeof AccountDtoSchema>;

declare const CategoryKindSchema: z.ZodEnum<["income", "expense"]>;
type CategoryKind = z.infer<typeof CategoryKindSchema>;
declare const CategoryDtoSchema: z.ZodObject<{
    id: z.ZodString;
    familyGroupId: z.ZodString;
    name: z.ZodString;
    kind: z.ZodEnum<["income", "expense"]>;
    color: z.ZodNullable<z.ZodString>;
    icon: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    familyGroupId: string;
    createdAt: string;
    kind: "income" | "expense";
    color: string | null;
    icon: string | null;
}, {
    id: string;
    name: string;
    familyGroupId: string;
    createdAt: string;
    kind: "income" | "expense";
    color: string | null;
    icon: string | null;
}>;
type CategoryDto = z.infer<typeof CategoryDtoSchema>;

declare const TransactionTypeSchema: z.ZodEnum<["income", "expense", "transfer"]>;
type TransactionType = z.infer<typeof TransactionTypeSchema>;
declare const CreateTransactionInputSchema: z.ZodObject<{
    accountId: z.ZodString;
    categoryId: z.ZodOptional<z.ZodString>;
    amount: z.ZodNumber;
    type: z.ZodEnum<["income", "expense", "transfer"]>;
    description: z.ZodOptional<z.ZodString>;
    occurredAt: z.ZodString;
    toAccountId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "income" | "expense" | "transfer";
    accountId: string;
    amount: number;
    occurredAt: string;
    categoryId?: string | undefined;
    description?: string | undefined;
    toAccountId?: string | undefined;
}, {
    type: "income" | "expense" | "transfer";
    accountId: string;
    amount: number;
    occurredAt: string;
    categoryId?: string | undefined;
    description?: string | undefined;
    toAccountId?: string | undefined;
}>;
type CreateTransactionInput = z.infer<typeof CreateTransactionInputSchema>;
declare const TransactionDtoSchema: z.ZodObject<{
    id: z.ZodString;
    familyGroupId: z.ZodString;
    accountId: z.ZodString;
    categoryId: z.ZodNullable<z.ZodString>;
    amount: z.ZodString;
    type: z.ZodEnum<["income", "expense", "transfer"]>;
    description: z.ZodNullable<z.ZodString>;
    occurredAt: z.ZodString;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "income" | "expense" | "transfer";
    id: string;
    familyGroupId: string;
    createdAt: string;
    accountId: string;
    categoryId: string | null;
    amount: string;
    description: string | null;
    occurredAt: string;
}, {
    type: "income" | "expense" | "transfer";
    id: string;
    familyGroupId: string;
    createdAt: string;
    accountId: string;
    categoryId: string | null;
    amount: string;
    description: string | null;
    occurredAt: string;
}>;
type TransactionDto = z.infer<typeof TransactionDtoSchema>;
declare const TransactionSummarySchema: z.ZodObject<{
    totalIncome: z.ZodString;
    totalExpense: z.ZodString;
    netBalance: z.ZodString;
    period: z.ZodObject<{
        from: z.ZodNullable<z.ZodString>;
        to: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        from: string | null;
        to: string | null;
    }, {
        from: string | null;
        to: string | null;
    }>;
}, "strip", z.ZodTypeAny, {
    totalIncome: string;
    totalExpense: string;
    netBalance: string;
    period: {
        from: string | null;
        to: string | null;
    };
}, {
    totalIncome: string;
    totalExpense: string;
    netBalance: string;
    period: {
        from: string | null;
        to: string | null;
    };
}>;
type TransactionSummary = z.infer<typeof TransactionSummarySchema>;
declare const TransactionListResponseSchema: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        familyGroupId: z.ZodString;
        accountId: z.ZodString;
        categoryId: z.ZodNullable<z.ZodString>;
        amount: z.ZodString;
        type: z.ZodEnum<["income", "expense", "transfer"]>;
        description: z.ZodNullable<z.ZodString>;
        occurredAt: z.ZodString;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "income" | "expense" | "transfer";
        id: string;
        familyGroupId: string;
        createdAt: string;
        accountId: string;
        categoryId: string | null;
        amount: string;
        description: string | null;
        occurredAt: string;
    }, {
        type: "income" | "expense" | "transfer";
        id: string;
        familyGroupId: string;
        createdAt: string;
        accountId: string;
        categoryId: string | null;
        amount: string;
        description: string | null;
        occurredAt: string;
    }>, "many">;
    meta: z.ZodObject<{
        total: z.ZodNumber;
        page: z.ZodNumber;
        limit: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        page: number;
        limit: number;
    }, {
        total: number;
        page: number;
        limit: number;
    }>;
    summary: z.ZodObject<{
        totalIncome: z.ZodString;
        totalExpense: z.ZodString;
        netBalance: z.ZodString;
        period: z.ZodObject<{
            from: z.ZodNullable<z.ZodString>;
            to: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            from: string | null;
            to: string | null;
        }, {
            from: string | null;
            to: string | null;
        }>;
    }, "strip", z.ZodTypeAny, {
        totalIncome: string;
        totalExpense: string;
        netBalance: string;
        period: {
            from: string | null;
            to: string | null;
        };
    }, {
        totalIncome: string;
        totalExpense: string;
        netBalance: string;
        period: {
            from: string | null;
            to: string | null;
        };
    }>;
}, "strip", z.ZodTypeAny, {
    data: {
        type: "income" | "expense" | "transfer";
        id: string;
        familyGroupId: string;
        createdAt: string;
        accountId: string;
        categoryId: string | null;
        amount: string;
        description: string | null;
        occurredAt: string;
    }[];
    meta: {
        total: number;
        page: number;
        limit: number;
    };
    summary: {
        totalIncome: string;
        totalExpense: string;
        netBalance: string;
        period: {
            from: string | null;
            to: string | null;
        };
    };
}, {
    data: {
        type: "income" | "expense" | "transfer";
        id: string;
        familyGroupId: string;
        createdAt: string;
        accountId: string;
        categoryId: string | null;
        amount: string;
        description: string | null;
        occurredAt: string;
    }[];
    meta: {
        total: number;
        page: number;
        limit: number;
    };
    summary: {
        totalIncome: string;
        totalExpense: string;
        netBalance: string;
        period: {
            from: string | null;
            to: string | null;
        };
    };
}>;
type TransactionListResponse = z.infer<typeof TransactionListResponseSchema>;

interface CashflowDto {
    months: string[];
    income: number[];
    expense: number[];
    max: number;
}
interface AllocationItemDto {
    label: string;
    value: number;
    amount: number;
    color: string;
}
interface AccountSummaryItemDto {
    type: string;
    label: string;
    total: number;
}
interface DashboardSummaryDto {
    netWorth: number;
    cashflow: CashflowDto;
    sparkline: number[];
    allocation: AllocationItemDto[];
    accountSummary: AccountSummaryItemDto[];
    currentMonth: {
        income: number;
        expense: number;
        net: number;
        savingsRate: number;
    };
    recentTransactions: {
        id: string;
        description: string | null;
        amount: number;
        type: "income" | "expense" | "transfer";
        categoryName: string | null;
        accountName: string;
        occurredAt: string;
    }[];
}

type BudgetPeriod = "monthly" | "weekly" | "yearly";
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

interface NotificationDto {
    id: string;
    title: string;
    body: string;
    icon: string | null;
    isRead: boolean;
    createdAt: string;
}

type InvestmentType = "saham" | "reksa_dana" | "obligasi" | "emas" | "kripto" | "lainnya";
interface InvestmentDto {
    id: string;
    familyGroupId: string;
    ticker: string;
    name: string;
    type: InvestmentType;
    quantity: string;
    costBasisPerUnit: string;
    currentPrice: string | null;
    currentValue: string | null;
    returnRp: string | null;
    returnPct: number | null;
    currency: string;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
}
interface InvestmentSummaryDto {
    totalCostBasis: string;
    totalCurrentValue: string;
    totalReturnRp: string;
    totalReturnPct: number;
    todayReturnRp: string;
    todayReturnPct: number;
}

export { type AccountDto, AccountDtoSchema, type AccountSummaryItemDto, type AccountType, AccountTypeSchema, type AllocationItemDto, type AuthUser, AuthUserSchema, type BudgetDto, type BudgetPeriod, CONTRACTS_VERSION, type CashflowDto, type CategoryDto, CategoryDtoSchema, type CategoryKind, CategoryKindSchema, type CreateAccountInput, CreateAccountInputSchema, type CreateBudgetDto, type CreateGoalDto, type CreateTransactionInput, CreateTransactionInputSchema, type DashboardSummaryDto, type GoalDto, type GoalStatus, type InvestmentDto, type InvestmentSummaryDto, type InvestmentType, type LoginInput, LoginInputSchema, type NotificationDto, type Rupiah, RupiahSchema, type SearchResponseDto, type SearchResultDto, type SearchResultType, type TransactionDto, TransactionDtoSchema, type TransactionListResponse, TransactionListResponseSchema, type TransactionSummary, TransactionSummarySchema, type TransactionType, TransactionTypeSchema, type UpdateAccountInput, UpdateAccountInputSchema, type UpdateBudgetDto, type UpdateGoalDto };
