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
    isPrivate: z.ZodOptional<z.ZodBoolean>;
    ownerUserId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "bank" | "ewallet" | "cash" | "investment" | "property";
    name: string;
    balance: number;
    currency: string;
    institution?: string | undefined;
    maskedNumber?: string | undefined;
    isPrivate?: boolean | undefined;
    ownerUserId?: string | undefined;
}, {
    type: "bank" | "ewallet" | "cash" | "investment" | "property";
    name: string;
    balance: number;
    institution?: string | undefined;
    maskedNumber?: string | undefined;
    currency?: string | undefined;
    isPrivate?: boolean | undefined;
    ownerUserId?: string | undefined;
}>;
type CreateAccountInput = z.infer<typeof CreateAccountInputSchema>;
declare const UpdateAccountInputSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["bank", "ewallet", "cash", "investment", "property"]>>;
    institution: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    maskedNumber: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    balance: z.ZodOptional<z.ZodNumber>;
    currency: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    isPrivate: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
} & {
    ownerUserId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    type?: "bank" | "ewallet" | "cash" | "investment" | "property" | undefined;
    name?: string | undefined;
    institution?: string | undefined;
    maskedNumber?: string | undefined;
    balance?: number | undefined;
    currency?: string | undefined;
    isPrivate?: boolean | undefined;
    ownerUserId?: string | null | undefined;
}, {
    type?: "bank" | "ewallet" | "cash" | "investment" | "property" | undefined;
    name?: string | undefined;
    institution?: string | undefined;
    maskedNumber?: string | undefined;
    balance?: number | undefined;
    currency?: string | undefined;
    isPrivate?: boolean | undefined;
    ownerUserId?: string | null | undefined;
}>;
type UpdateAccountInput = z.infer<typeof UpdateAccountInputSchema>;
declare const AccountOwnerFilterSchema: z.ZodEnum<["me", "family", "all"]>;
type AccountOwnerFilter = z.infer<typeof AccountOwnerFilterSchema>;
declare const AccountDtoSchema: z.ZodObject<{
    id: z.ZodString;
    familyGroupId: z.ZodString;
    name: z.ZodString;
    type: z.ZodEnum<["bank", "ewallet", "cash", "investment", "property"]>;
    institution: z.ZodNullable<z.ZodString>;
    maskedNumber: z.ZodNullable<z.ZodString>;
    balance: z.ZodString;
    currency: z.ZodString;
    isPrivate: z.ZodBoolean;
    ownerUserId: z.ZodNullable<z.ZodString>;
    ownerName: z.ZodNullable<z.ZodString>;
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
    isPrivate: boolean;
    ownerUserId: string | null;
    familyGroupId: string;
    ownerName: string | null;
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
    isPrivate: boolean;
    ownerUserId: string | null;
    familyGroupId: string;
    ownerName: string | null;
    createdAt: string;
    updatedAt: string;
}>;
type AccountDto = z.infer<typeof AccountDtoSchema>;

declare const AllowanceRequestStatusSchema: z.ZodEnum<["pending", "approved", "rejected"]>;
type AllowanceRequestStatus = z.infer<typeof AllowanceRequestStatusSchema>;
declare const AllowanceRequestKindSchema: z.ZodEnum<["funding", "held_expense"]>;
type AllowanceRequestKind = z.infer<typeof AllowanceRequestKindSchema>;
declare const CreateAllowanceRequestInputSchema: z.ZodObject<{
    targetAccountId: z.ZodString;
    amount: z.ZodNumber;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    targetAccountId: string;
    amount: number;
    note?: string | undefined;
}, {
    targetAccountId: string;
    amount: number;
    note?: string | undefined;
}>;
type CreateAllowanceRequestInput = z.infer<typeof CreateAllowanceRequestInputSchema>;
declare const ApproveAllowanceRequestInputSchema: z.ZodObject<{
    fromAccountId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    fromAccountId?: string | undefined;
}, {
    fromAccountId?: string | undefined;
}>;
type ApproveAllowanceRequestInput = z.infer<typeof ApproveAllowanceRequestInputSchema>;
declare const RejectAllowanceRequestInputSchema: z.ZodObject<{
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reason?: string | undefined;
}, {
    reason?: string | undefined;
}>;
type RejectAllowanceRequestInput = z.infer<typeof RejectAllowanceRequestInputSchema>;
declare const AllowanceRequestDtoSchema: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<["funding", "held_expense"]>;
    familyGroupId: z.ZodString;
    requesterUserId: z.ZodString;
    requesterName: z.ZodString;
    targetAccountId: z.ZodString;
    targetAccountName: z.ZodString;
    fromAccountId: z.ZodNullable<z.ZodString>;
    fromAccountName: z.ZodNullable<z.ZodString>;
    amount: z.ZodString;
    note: z.ZodNullable<z.ZodString>;
    categoryId: z.ZodNullable<z.ZodString>;
    categoryName: z.ZodNullable<z.ZodString>;
    description: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["pending", "approved", "rejected"]>;
    createdAt: z.ZodString;
    decidedAt: z.ZodNullable<z.ZodString>;
    decidedByUserId: z.ZodNullable<z.ZodString>;
    decidedByName: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "approved" | "rejected";
    id: string;
    familyGroupId: string;
    createdAt: string;
    targetAccountId: string;
    amount: string;
    note: string | null;
    fromAccountId: string | null;
    kind: "funding" | "held_expense";
    requesterUserId: string;
    requesterName: string;
    targetAccountName: string;
    fromAccountName: string | null;
    categoryId: string | null;
    categoryName: string | null;
    description: string | null;
    decidedAt: string | null;
    decidedByUserId: string | null;
    decidedByName: string | null;
}, {
    status: "pending" | "approved" | "rejected";
    id: string;
    familyGroupId: string;
    createdAt: string;
    targetAccountId: string;
    amount: string;
    note: string | null;
    fromAccountId: string | null;
    kind: "funding" | "held_expense";
    requesterUserId: string;
    requesterName: string;
    targetAccountName: string;
    fromAccountName: string | null;
    categoryId: string | null;
    categoryName: string | null;
    description: string | null;
    decidedAt: string | null;
    decidedByUserId: string | null;
    decidedByName: string | null;
}>;
type AllowanceRequestDto = z.infer<typeof AllowanceRequestDtoSchema>;
declare const HeldExpenseResponseSchema: z.ZodObject<{
    held: z.ZodLiteral<true>;
    allowanceRequestId: z.ZodString;
    amount: z.ZodString;
}, "strip", z.ZodTypeAny, {
    amount: string;
    held: true;
    allowanceRequestId: string;
}, {
    amount: string;
    held: true;
    allowanceRequestId: string;
}>;
type HeldExpenseResponse = z.infer<typeof HeldExpenseResponseSchema>;

declare const MemberRelationshipSchema: z.ZodEnum<["istri", "anak", "kakek", "nenek", "bibi", "supir", "sekretaris", "bendahara"]>;
type MemberRelationship = z.infer<typeof MemberRelationshipSchema>;
declare const RoleSchema: z.ZodEnum<["owner", "member", "admin_staff", "spouse", "dependant", "operational"]>;
type Role = z.infer<typeof RoleSchema>;
/**
 * Relationship -> default role. Pre-fills the role picker when a head adds a
 * member by kinship; the result stays fully editable for every relationship
 * EXCEPT `istri` — the API accepts any (relationship, role) pair for the
 * others, but `istri` is now enforced server-side as `role: owner` and
 * capped at one per family group (EPIC-024 A1, D1: "istri = co-master
 * penuh"). This supersedes EPIC-023 D2/D6's `spouse` role for wives — the
 * `spouse` role/invite flow remains in code for non-wife cases only.
 */
declare const DEFAULT_ROLE_BY_RELATIONSHIP: Record<MemberRelationship, Role>;
declare function defaultRoleForRelationship(relationship: MemberRelationship): Role;

declare const CategoryKindSchema: z.ZodEnum<["income", "expense"]>;
type CategoryKind = z.infer<typeof CategoryKindSchema>;
declare const CategoryDtoSchema: z.ZodObject<{
    id: z.ZodString;
    familyGroupId: z.ZodString;
    name: z.ZodString;
    kind: z.ZodEnum<["income", "expense"]>;
    coaAccountId: z.ZodString;
    color: z.ZodNullable<z.ZodString>;
    icon: z.ZodNullable<z.ZodString>;
    isPrivate: z.ZodBoolean;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    isPrivate: boolean;
    familyGroupId: string;
    createdAt: string;
    kind: "income" | "expense";
    coaAccountId: string;
    color: string | null;
    icon: string | null;
}, {
    id: string;
    name: string;
    isPrivate: boolean;
    familyGroupId: string;
    createdAt: string;
    kind: "income" | "expense";
    coaAccountId: string;
    color: string | null;
    icon: string | null;
}>;
type CategoryDto = z.infer<typeof CategoryDtoSchema>;

/**
 * Shared Chart-of-Accounts constants (EPIC-017). Prisma-agnostic — direction
 * and budgetType are plain string-literal unions so both the API and the web
 * app can import this without a Prisma dependency. The values match the
 * `CoaDirection` / `CoaBudgetType` Prisma enums.
 *
 * `GENERIC_COA_CHART` is the generic, non-personalized chart provisioned for
 * EVERY family group (at registration — API `auth.service` and web Better-Auth
 * hook — and, for pre-existing groups, by the `add_category_coa_link`
 * migration). Keep it in sync with that migration's raw-SQL VALUES list.
 *
 * `groupNum` taxonomy: 1 Income · 2 Expense · 3 Wealth Allocation ·
 * 4 Receivable · 5 Payable · 6 Tax.
 */
type CoaChartDirection = "INCOME" | "EXPENSE" | "TRANSFER";
type CoaChartBudgetType = "FIXED" | "VARIABLE" | "REIMBURSEMENT";
type CoaChartEntry = {
    code: string;
    name: string;
    groupNum: number;
    direction: CoaChartDirection;
    budgetType: CoaChartBudgetType;
};
declare const GENERIC_COA_CHART: readonly CoaChartEntry[];
/**
 * Pick a generic-chart COA code for a category by name hint, then kind fallback.
 * Direction compatibility: income → INCOME only; expense → EXPENSE or TRANSFER
 * (a savings/investment outflow is a valid target for an expense-kind category).
 * An income hint is never selected for an expense category and vice-versa.
 */
declare function defaultCoaCodeForCategory(kind: "income" | "expense", name: string): string;

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
    adminFee: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type: "income" | "expense" | "transfer";
    amount: number;
    accountId: string;
    occurredAt: string;
    categoryId?: string | undefined;
    description?: string | undefined;
    toAccountId?: string | undefined;
    adminFee?: number | undefined;
}, {
    type: "income" | "expense" | "transfer";
    amount: number;
    accountId: string;
    occurredAt: string;
    categoryId?: string | undefined;
    description?: string | undefined;
    toAccountId?: string | undefined;
    adminFee?: number | undefined;
}>;
type CreateTransactionInput = z.infer<typeof CreateTransactionInputSchema>;
declare const TransactionDtoSchema: z.ZodObject<{
    id: z.ZodString;
    familyGroupId: z.ZodString;
    accountId: z.ZodNullable<z.ZodString>;
    toAccountId: z.ZodNullable<z.ZodString>;
    categoryId: z.ZodNullable<z.ZodString>;
    liabilityId: z.ZodNullable<z.ZodString>;
    insuranceId: z.ZodNullable<z.ZodString>;
    amount: z.ZodString;
    type: z.ZodEnum<["income", "expense", "transfer"]>;
    description: z.ZodNullable<z.ZodString>;
    categoryName: z.ZodNullable<z.ZodString>;
    accountName: z.ZodNullable<z.ZodString>;
    toAccountName: z.ZodNullable<z.ZodString>;
    occurredAt: z.ZodString;
    createdAt: z.ZodString;
    canModify: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    type: "income" | "expense" | "transfer";
    id: string;
    familyGroupId: string;
    createdAt: string;
    amount: string;
    categoryId: string | null;
    categoryName: string | null;
    description: string | null;
    accountId: string | null;
    occurredAt: string;
    toAccountId: string | null;
    liabilityId: string | null;
    insuranceId: string | null;
    accountName: string | null;
    toAccountName: string | null;
    canModify: boolean;
}, {
    type: "income" | "expense" | "transfer";
    id: string;
    familyGroupId: string;
    createdAt: string;
    amount: string;
    categoryId: string | null;
    categoryName: string | null;
    description: string | null;
    accountId: string | null;
    occurredAt: string;
    toAccountId: string | null;
    liabilityId: string | null;
    insuranceId: string | null;
    accountName: string | null;
    toAccountName: string | null;
    canModify: boolean;
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
        accountId: z.ZodNullable<z.ZodString>;
        toAccountId: z.ZodNullable<z.ZodString>;
        categoryId: z.ZodNullable<z.ZodString>;
        liabilityId: z.ZodNullable<z.ZodString>;
        insuranceId: z.ZodNullable<z.ZodString>;
        amount: z.ZodString;
        type: z.ZodEnum<["income", "expense", "transfer"]>;
        description: z.ZodNullable<z.ZodString>;
        categoryName: z.ZodNullable<z.ZodString>;
        accountName: z.ZodNullable<z.ZodString>;
        toAccountName: z.ZodNullable<z.ZodString>;
        occurredAt: z.ZodString;
        createdAt: z.ZodString;
        canModify: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        type: "income" | "expense" | "transfer";
        id: string;
        familyGroupId: string;
        createdAt: string;
        amount: string;
        categoryId: string | null;
        categoryName: string | null;
        description: string | null;
        accountId: string | null;
        occurredAt: string;
        toAccountId: string | null;
        liabilityId: string | null;
        insuranceId: string | null;
        accountName: string | null;
        toAccountName: string | null;
        canModify: boolean;
    }, {
        type: "income" | "expense" | "transfer";
        id: string;
        familyGroupId: string;
        createdAt: string;
        amount: string;
        categoryId: string | null;
        categoryName: string | null;
        description: string | null;
        accountId: string | null;
        occurredAt: string;
        toAccountId: string | null;
        liabilityId: string | null;
        insuranceId: string | null;
        accountName: string | null;
        toAccountName: string | null;
        canModify: boolean;
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
        amount: string;
        categoryId: string | null;
        categoryName: string | null;
        description: string | null;
        accountId: string | null;
        occurredAt: string;
        toAccountId: string | null;
        liabilityId: string | null;
        insuranceId: string | null;
        accountName: string | null;
        toAccountName: string | null;
        canModify: boolean;
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
        amount: string;
        categoryId: string | null;
        categoryName: string | null;
        description: string | null;
        accountId: string | null;
        occurredAt: string;
        toAccountId: string | null;
        liabilityId: string | null;
        insuranceId: string | null;
        accountName: string | null;
        toAccountName: string | null;
        canModify: boolean;
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
interface NetWorthDto {
    accountsTotal: string;
    investmentsTotal: string;
    assetsTotal: string;
    liabilitiesTotal: string;
    netWorth: string;
    currency: string;
}
interface NetWorthHistoryPointDto {
    capturedAt: string;
    totalCash: string;
    totalInvestments: string;
    totalAssets: string;
    totalLiabilities: string;
    netWorth: string;
}
interface NetWorthHistoryDto {
    range: string;
    currency: string;
    points: NetWorthHistoryPointDto[];
}
interface DashboardSummaryDto {
    netWorth: number;
    assetsTotal: number;
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
        accountName: string | null;
        occurredAt: string;
    }[];
}

type BudgetPeriod = "monthly" | "weekly" | "yearly";
/** EPIC-017: a budget's COA budget type, resolved via its category's COA account. */
type BudgetType = "FIXED" | "VARIABLE" | "REIMBURSEMENT";
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
    budgetType: BudgetType | null;
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
    /** EPIC-033 group 5 — day of month (1-28) the auto-debit runs. */
    autoDebitDay: number | null;
    /** Revisi F — account the daily auto-debit draws from. */
    sourceAccountId: string | null;
    status: GoalStatus;
    progressPercent: number;
    remainingAmount: number;
}
interface CreateGoalDto {
    name: string;
    icon?: string;
    targetAmount: number;
    currentAmount?: number;
    targetDate?: string;
    autoDebitAmount?: number;
    autoDebitDay?: number;
    sourceAccountId?: string;
}
interface UpdateGoalDto {
    name?: string;
    icon?: string;
    targetAmount?: number;
    currentAmount?: number;
    targetDate?: string;
    autoDebitAmount?: number | null;
    autoDebitDay?: number;
    sourceAccountId?: string;
}
declare const GoalContributionSourceSchema: z.ZodEnum<["manual", "auto"]>;
type GoalContributionSource = z.infer<typeof GoalContributionSourceSchema>;
declare const CreateGoalContributionInputSchema: z.ZodObject<{
    amount: z.ZodString;
    accountId: z.ZodOptional<z.ZodString>;
    occurredAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    amount: string;
    accountId?: string | undefined;
    occurredAt?: string | undefined;
}, {
    amount: string;
    accountId?: string | undefined;
    occurredAt?: string | undefined;
}>;
type CreateGoalContributionInput = z.infer<typeof CreateGoalContributionInputSchema>;
declare const GoalContributionDtoSchema: z.ZodObject<{
    id: z.ZodString;
    goalId: z.ZodString;
    amount: z.ZodString;
    accountId: z.ZodNullable<z.ZodString>;
    accountName: z.ZodNullable<z.ZodString>;
    transactionId: z.ZodNullable<z.ZodString>;
    occurredAt: z.ZodString;
    source: z.ZodEnum<["manual", "auto"]>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    amount: string;
    accountId: string | null;
    occurredAt: string;
    accountName: string | null;
    goalId: string;
    transactionId: string | null;
    source: "manual" | "auto";
}, {
    id: string;
    createdAt: string;
    amount: string;
    accountId: string | null;
    occurredAt: string;
    accountName: string | null;
    goalId: string;
    transactionId: string | null;
    source: "manual" | "auto";
}>;
type GoalContributionDto = z.infer<typeof GoalContributionDtoSchema>;
interface GoalContributionResult {
    contribution: GoalContributionDto;
    goal: GoalDto;
}

interface NotificationDto {
    id: string;
    title: string;
    body: string;
    icon: string | null;
    isRead: boolean;
    createdAt: string;
}

type AssetTypeId = "properti" | "kendaraan" | "elektronik" | "perhiasan" | "emas" | "lainnya";
type AssetValueChangeMode = "percent" | "fixed";
interface AssetDto {
    id: string;
    familyGroupId: string;
    name: string;
    type: string;
    currentValue: string;
    currency: string;
    notes: string | null;
    valueChangeRatePct: string | null;
    valueChangeMode: AssetValueChangeMode;
    valueChangeAmount: string | null;
    categoryId: string | null;
    acquisitionDate: string | null;
    currentEstimatedValue: string;
    createdAt: string;
    updatedAt: string;
}
declare const DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT: Record<AssetTypeId, number>;
/** EPIC-033 p14 — a document attached to a physical asset. */
interface AssetAttachmentDto {
    id: string;
    assetId: string;
    mimeType: string;
    size: number;
    createdAt: string;
}
interface AssetHistoryDto {
    id: string;
    assetId: string;
    value: string;
    recordedAt: string;
    /** EPIC-033 group 3 — percent change vs the previous entry (2 decimals), null on the first. */
    changePercent: string | null;
    recordedByName: string | null;
    note: string | null;
}
interface CreateAssetDto {
    name: string;
    type: string;
    currentValue: string;
    currency?: string;
    notes?: string;
    valueChangeRatePct?: string;
    valueChangeMode?: AssetValueChangeMode;
    valueChangeAmount?: string;
    categoryId?: string;
    acquisitionDate?: string;
}
interface UpdateAssetDto {
    name?: string;
    type?: string;
    currentValue?: string;
    currency?: string;
    notes?: string;
    valueChangeRatePct?: string;
    valueChangeMode?: AssetValueChangeMode;
    valueChangeAmount?: string;
    categoryId?: string;
    acquisitionDate?: string;
}

type InvestmentType = "saham" | "reksa_dana" | "obligasi" | "emas" | "kripto" | "lainnya" | "deposito";
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
    latestPriceRecordedAt: string | null;
    latestPriceSource: string | null;
    latestPriceAsOf: string | null;
    latestPriceDelayed: boolean | null;
    priceRefreshFailed: boolean;
    automatedPriceUnmapped: boolean;
    automatedPriceSimulated: boolean;
    interestRatePct: string | null;
    projectedAnnualYield: string | null;
    purchasedAt: string | null;
    maturityDate: string | null;
    realizedPnlRp: string | null;
    createdAt: string;
    updatedAt: string;
}
type InvestmentTxType = "buy" | "sell";
interface InvestmentTransactionDto {
    id: string;
    investmentId: string;
    type: InvestmentTxType;
    quantity: string;
    pricePerUnit: string;
    occurredAt: string;
    realizedPnl: string | null;
    createdAt: string;
}
interface InvestmentSummaryDto {
    totalCostBasis: string;
    totalCurrentValue: string;
    totalReturnRp: string;
    totalReturnPct: number;
    todayReturnRp: string;
    todayReturnPct: number;
}
interface InvestmentPriceDto {
    id: string;
    investmentId: string;
    price: string;
    source: string;
    asOf: string;
    delayed: boolean;
    recordedAt: string;
}

type LiabilityType = "kartu_kredit" | "pinjaman_pribadi" | "kpr" | "kendaraan" | "lainnya";
type InterestMethod = "efektif" | "flat" | "anuitas";
type KprScheme = "konvensional" | "berjenjang" | "flpp" | "syariah_murabahah" | "syariah_mmq";
type RatePeriodKind = "fixed" | "floating";
type PrepaymentMode = "full" | "reduce_tenor" | "reduce_installment";
interface LiabilityRatePeriodDto {
    kind: RatePeriodKind;
    months: number | null;
    ratePercent: string;
}
interface LiabilityDto {
    id: string;
    familyGroupId: string;
    name: string;
    institution: string | null;
    type: LiabilityType;
    totalDebt: string;
    remainingBalance: string;
    minimumPayment: string;
    interestRate: string;
    dueDate: string | null;
    nextDueDate: string | null;
    autoAdvanceDueDate: boolean;
    paymentRatio: number;
    paidThisPeriod: boolean;
    notes: string | null;
    currency: string;
    interestMethod: InterestMethod;
    tenorMonths: number | null;
    startDate: string | null;
    installmentAmount: string | null;
    currentInstallmentAmount: string | null;
    fixedRateMonths: number | null;
    floatingRate: string | null;
    kprScheme: KprScheme | null;
    ratePeriods: LiabilityRatePeriodDto[];
    currentRatePercent: string;
    currentInstallmentLate: boolean;
    createdAt: string;
    updatedAt: string;
}
interface LiabilitySummaryDto {
    totalRemainingBalance: string;
    totalDebt: string;
    currency: string;
}
interface CreateLiabilityDto {
    name: string;
    institution?: string;
    type: LiabilityType;
    totalDebt: string;
    remainingBalance: string;
    minimumPayment?: string;
    interestRate?: string;
    dueDate?: string;
    autoAdvanceDueDate?: boolean;
    notes?: string;
    currency?: string;
    interestMethod?: InterestMethod;
    tenorMonths?: number;
    startDate?: string;
    installmentAmount?: string;
    fixedRateMonths?: number;
    floatingRate?: string;
    kprScheme?: KprScheme;
    ratePeriods?: LiabilityRatePeriodDto[];
}
interface UpdateLiabilityDto {
    name?: string;
    institution?: string;
    type?: LiabilityType;
    totalDebt?: string;
    remainingBalance?: string;
    minimumPayment?: string;
    interestRate?: string;
    dueDate?: string;
    autoAdvanceDueDate?: boolean;
    notes?: string;
    currency?: string;
    interestMethod?: InterestMethod;
    tenorMonths?: number;
    startDate?: string | null;
    installmentAmount?: string;
    fixedRateMonths?: number;
    floatingRate?: string;
    kprScheme?: KprScheme;
    ratePeriods?: LiabilityRatePeriodDto[];
}
interface LiabilityScheduleRowDto {
    period: number;
    installment: string;
    interest: string;
    principal: string;
    remaining: string;
}
interface LiabilityRateBandDto {
    fromPeriod: number;
    toPeriod: number;
    ratePercent: string;
    kind: RatePeriodKind;
}
interface LiabilityScheduleDto {
    liabilityId: string;
    interestMethod: InterestMethod;
    installmentAmount: string | null;
    rows: LiabilityScheduleRowDto[];
    rateBands: LiabilityRateBandDto[];
    hasFloatingPeriod: boolean;
}
interface LiabilityPaymentPreviewDto {
    liabilityId: string;
    amount: string;
    interest: string;
    principal: string;
    remainingAfter: string;
}
interface LiabilityFloatingRateDto {
    id: string;
    effectiveDate: string;
    ratePercent: string;
    effectivePeriod: number | null;
    note: string | null;
    createdAt: string;
}
interface CreateLiabilityFloatingRateDto {
    effectiveDate: string;
    ratePercent: string;
    note?: string;
}
interface LiabilityPrepaymentPreviewDto {
    liabilityId: string;
    mode: PrepaymentMode;
    prepaidPrincipal: string;
    penaltyPercent: string;
    penalty: string;
    cashOutNow: string;
    installmentBefore: string | null;
    installmentAfter: string | null;
    remainingMonthsBefore: number;
    remainingMonthsAfter: number;
    totalInterestBefore: string;
    totalInterestAfter: string;
    interestSaved: string;
    netSaving: string;
    assumesCurrentFloatingRate: boolean;
}
interface RecordLiabilityPrepaymentDto {
    sourceAccountId: string;
    mode: PrepaymentMode;
    amount?: string;
    penaltyPercent?: string;
    idempotencyKey: string;
}
interface LiabilityPrepaymentDto {
    id: string;
    mode: PrepaymentMode;
    principalAmount: string;
    penaltyPercent: string;
    penaltyAmount: string;
    effectivePeriod: number;
    installmentBefore: string | null;
    installmentAfter: string | null;
    tenorMonthsBefore: number;
    tenorMonthsAfter: number;
    occurredAt: string;
}
interface LiabilityPrepaymentRecordResultDto {
    liability: LiabilityDto;
    prepayment: LiabilityPrepaymentDto;
    replayed: boolean;
}

declare const SetMemberCategoryAllowanceInputSchema: z.ZodObject<{
    categoryIds: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    categoryIds: string[];
}, {
    categoryIds: string[];
}>;
type SetMemberCategoryAllowanceInput = z.infer<typeof SetMemberCategoryAllowanceInputSchema>;
declare const AllowedCategoryDtoSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
}, {
    id: string;
    name: string;
}>;
declare const MemberCategoryAllowanceDtoSchema: z.ZodObject<{
    memberId: z.ZodString;
    categories: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
    }, {
        id: string;
        name: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    memberId: string;
    categories: {
        id: string;
        name: string;
    }[];
}, {
    memberId: string;
    categories: {
        id: string;
        name: string;
    }[];
}>;
type MemberCategoryAllowanceDto = z.infer<typeof MemberCategoryAllowanceDtoSchema>;

type InheritanceVisibility = "private" | "heirs_only" | "all_members";
interface InheritanceHeirDto {
    id: string;
    inheritanceAssetId: string;
    name: string;
    relationship: string;
    sharePercent: string;
    memberUserId: string | null;
    createdAt: string;
}
interface InheritanceAssetDto {
    id: string;
    familyGroupId: string;
    name: string;
    assetType: string;
    estimatedValue: string;
    currency: string;
    notes: string | null;
    visibility: InheritanceVisibility;
    documentUrl: string | null;
    assetId: string | null;
    heirs: InheritanceHeirDto[];
    createdAt: string;
    updatedAt: string;
}
interface CreateHeirDto {
    name: string;
    relationship: string;
    sharePercent: number;
    memberUserId?: string;
}
interface CreateInheritanceAssetDto {
    name: string;
    assetType: string;
    estimatedValue: number;
    currency?: string;
    notes?: string;
    visibility?: InheritanceVisibility;
    assetId?: string;
    heirs?: CreateHeirDto[];
}
interface UpdateInheritanceAssetDto {
    name?: string;
    assetType?: string;
    estimatedValue?: number;
    currency?: string;
    notes?: string;
    visibility?: InheritanceVisibility;
    assetId?: string | null;
    heirs?: CreateHeirDto[];
}

type InsuranceType = "jiwa" | "kesehatan" | "kendaraan" | "properti" | "pendidikan" | "lainnya";
type InsuranceStatus = "aktif" | "tidak_aktif" | "kadaluarsa";
type PremiumPeriod = "monthly" | "quarterly" | "yearly";
interface InsuranceBeneficiaryDto {
    id: string;
    insuranceId: string;
    name: string;
    relationship: string;
    sharePercent: string;
    memberUserId: string | null;
    createdAt: string;
}
interface CreateInsuranceBeneficiaryDto {
    name: string;
    relationship: string;
    sharePercent: number;
    memberUserId?: string;
}
interface InsuranceDto {
    id: string;
    familyGroupId: string;
    name: string;
    provider: string | null;
    type: InsuranceType;
    status: InsuranceStatus;
    coverageAmount: string | null;
    premiumAmount: string;
    premiumPeriod: PremiumPeriod;
    renewalDate: string | null;
    autoRenewDate: boolean;
    policyNumber: string | null;
    daysUntilRenewal: number | null;
    notes: string | null;
    currency: string;
    beneficiaries: InsuranceBeneficiaryDto[];
    paidThisPeriod: boolean;
    createdAt: string;
    updatedAt: string;
}
interface InsuranceSummaryDto {
    activePolicies: number;
    totalMonthlyPremium: string;
    currency: string;
}
interface CreateInsuranceDto {
    name: string;
    provider?: string;
    type: InsuranceType;
    status?: InsuranceStatus;
    coverageAmount?: string;
    premiumAmount: string;
    premiumPeriod?: PremiumPeriod;
    renewalDate?: string;
    autoRenewDate?: boolean;
    policyNumber?: string;
    notes?: string;
    currency?: string;
    beneficiaries?: CreateInsuranceBeneficiaryDto[];
}
interface UpdateInsuranceDto {
    name?: string;
    provider?: string;
    type?: InsuranceType;
    status?: InsuranceStatus;
    coverageAmount?: string;
    premiumAmount?: string;
    premiumPeriod?: PremiumPeriod;
    renewalDate?: string;
    autoRenewDate?: boolean;
    policyNumber?: string;
    notes?: string;
    currency?: string;
    beneficiaries?: CreateInsuranceBeneficiaryDto[];
}

type SplitStatus = "open" | "settled";
type ParticipantStatus = "pending" | "claimed" | "paid";
interface SplitParticipantDto {
    id: string;
    splitBillId: string;
    name: string;
    amountOwed: string;
    status: ParticipantStatus;
    shareToken: string;
    claimedAt: string | null;
    paidAt: string | null;
    createdAt: string;
}
interface SplitBillDto {
    id: string;
    familyGroupId: string;
    title: string;
    totalAmount: string;
    currency: string;
    status: SplitStatus;
    notes: string | null;
    payoutAccountId: string | null;
    payoutInstructions: string | null;
    revokedAt: string | null;
    createdAt: string;
    updatedAt: string;
    participants: SplitParticipantDto[];
}
interface CreateSplitParticipantDto {
    name: string;
    amountOwed: number;
}
interface CreateSplitBillDto {
    title: string;
    totalAmount: number;
    notes?: string;
    payoutAccountId: string;
    payoutInstructions?: string;
    participants: CreateSplitParticipantDto[];
}
interface UpdatePayoutAccountDto {
    payoutAccountId: string;
}
interface SplitBillPayoutDto {
    accountName: string | null;
    accountInstitution: string | null;
    accountMaskedNumber: string | null;
    instructions: string | null;
    configured: boolean;
}
interface PublicSplitParticipantDto {
    billTitle: string;
    participantName: string;
    amountOwed: string;
    currency: string;
    status: ParticipantStatus;
    claimedAt: string | null;
    paidAt: string | null;
    payout: SplitBillPayoutDto;
}

type ReportPeriod = "daily" | "monthly" | "yearly";
interface PeriodPoint {
    label: string;
    income: number;
    expense: number;
    net: number;
}
interface SankeyNode {
    id: string;
    label: string;
}
interface SankeyLink {
    source: string;
    target: string;
    value: number;
}
interface SankeyDto {
    nodes: SankeyNode[];
    links: SankeyLink[];
}
interface CategoryBreakdownItem {
    categoryName: string;
    amount: number;
    percentage: number;
    color: string | null;
}
interface ReportSummaryDto {
    period: ReportPeriod;
    points: PeriodPoint[];
    totalIncome: number;
    totalExpense: number;
    netSavings: number;
    savingsRate: number;
    topIncomeCategories: CategoryBreakdownItem[];
    topExpenseCategories: CategoryBreakdownItem[];
}
interface BankBreakdownItem {
    accountName: string;
    institution: string | null;
    income: number;
    expense: number;
    balance: number;
}
interface BankReportDto {
    period: ReportPeriod;
    startDate: string;
    endDate: string;
    banks: BankBreakdownItem[];
    totalIncome: number;
    totalExpense: number;
}
interface DetailTransactionItem {
    id: string;
    occurredAt: string;
    description: string | null;
    categoryName: string | null;
    accountName: string | null;
    type: "income" | "expense" | "transfer";
    amount: number;
}
interface DetailReportDto {
    period: ReportPeriod;
    startDate: string;
    endDate: string;
    transactions: DetailTransactionItem[];
    totalIncome: number;
    totalExpense: number;
    count: number;
}
interface PnlDto {
    startDate: string;
    endDate: string;
    revenue: number;
    expenses: number;
    netProfit: number;
    previousRevenue: number;
    previousExpenses: number;
    previousNetProfit: number;
    revenueGrowth: number;
    expenseGrowth: number;
    profitGrowth: number;
    revenueBreakdown: CategoryBreakdownItem[];
    expenseBreakdown: CategoryBreakdownItem[];
}
interface BalanceSheetDto {
    /**
     * The date these figures actually represent. When `dataAvailable` is true
     * and the figures come from a `NetWorthSnapshot` (EPIC-023 B2), this is
     * the SNAPSHOT's own date — which may be earlier than the requested
     * as-of date when it is the most recent snapshot on or before it, never a
     * later one. Reporting the requested date instead would silently imply
     * fresher data than what is actually shown.
     */
    asOfDate: string;
    totalAssets: number;
    totalLiabilities: number;
    netWorth: number;
    assets: {
        category: string;
        amount: number;
        items: {
            name: string;
            amount: number;
        }[];
    }[];
    liabilities: {
        category: string;
        amount: number;
        items: {
            name: string;
            amount: number;
        }[];
    }[];
    /**
     * EPIC-023 B2 (closes EPIC-022 B11) — honest "do we actually have a
     * figure for this date" signal. False when the family has snapshot
     * history but none on or before the requested date — the response is
     * zeroed out rather than inventing a real-looking figure. (When the
     * family has captured no snapshot at all yet, this is still true and the
     * response falls back to live current totals — see reports.service.ts.)
     */
    dataAvailable: boolean;
    /**
     * True when the figures above come from a historical `NetWorthSnapshot`
     * (a real point-in-time figure). False when they were computed from
     * live/current balances instead (no snapshot history exists yet for this
     * family) — in that case the figures are NOT a historical statement for
     * `asOfDate`, only the current totals.
     */
    isHistorical: boolean;
    /**
     * EPIC-023 Task B retry (CRITICAL 2) — a `NetWorthSnapshot` is captured
     * with privacy fully open (`computeNetWorthBreakdown(familyGroupId, true)`
     * — see dashboard.service.ts's `captureSnapshot`), so it has no per-viewer
     * breakdown to fall back to. True when this viewer may NOT see private
     * items (`canSeePrivate` false) AND the family has at least one private
     * account: the snapshot exists but cannot be shown to THIS viewer without
     * leaking hidden money, so every figure above is zeroed out and
     * `dataAvailable` is false for that reason alone (distinct from "no
     * snapshot exists for this date at all"). Always false when the family
     * has no private accounts, or when the viewer may see everything.
     */
    restrictedForViewer: boolean;
}
interface ReconciliationBridgeDto {
    startDate: string;
    endDate: string;
    /** Net worth at the start of the period (from the last snapshot on or
     * before `startDate` itself), or 0 when unavailable. */
    opening: number;
    /** Net worth at the end of the period (from the last snapshot on or
     * before `endDate`), or 0 when unavailable. */
    closing: number;
    /** Revenue − expenses over the period, COA-direction classified — TRANSFER
     * (wealth allocation / debt principal) is excluded, matching the P&L. */
    profit: number;
    /** Signed sum of the period's COA group-3 ("Wealth Allocation") TRANSFER
     * transactions — cash moved into a holding (+) or withdrawn back to cash
     * (−). A real two-sided transfer between two of the family's own
     * accounts contributes 0 (both legs are already inside `totalCash`). A
     * real SUBTRAHEND in the identity above now, not a memo line folded into
     * a derived figure — see `holdingsChange` below for why. */
    contribution: number;
    /** RAW combined change in physical assets AND investments: (Δ
     * totalAssets + Δ totalInvestments). Nothing is subtracted — this is the
     * directly-measured snapshot delta, not a market-movement-only figure.
     * Not split by asset/investment — nothing links a contribution to which
     * of the two it funded, so a split would misattribute a real gain the
     * same way an asset-vs-investment contribution split once misattributed
     * a contribution. */
    holdingsChange: number;
    /** `closing − (opening + profit − contribution + holdingsChange)` — an
     * HONESTLY NAMED residual, not forced to zero. Two independent, named
     * reasons it is not always zero: (1) COA group 4 (Receivable) has no
     * counterpart in the net-worth breakdown (no receivable table backs it),
     * so lending money out lowers cash with nothing to offset it; (2) a
     * back-dated entry can move a balance in one snapshot period and its
     * profit in another, since snapshots record CAPTURE time while profit is
     * computed from `occurredAt` — see `getReconciliationBridge`'s doc
     * comment. Naming the gap is more honest than hiding it inside another
     * term. */
    unexplained: number;
    /** False when either endpoint has no snapshot at or before it — an
     * honest "no data" signal, matching `BalanceSheetDto.dataAvailable`. */
    dataAvailable: boolean;
    /** EPIC-023 Task B retry (CRITICAL 2), widened by EPIC-023 Task B3 review
     * (HIGH, FIX 2) — true when this viewer may not see private items AND
     * the family has at least one private `Account` OR at least one private
     * `Category`, so `opening`/`closing` (privacy-unaware snapshot totals)
     * cannot be shown alongside a privacy-filtered `profit`/`contribution`.
     * Wider than `BalanceSheetDto.restrictedForViewer` (accounts only) —
     * see `familyHasPrivateItems`'s doc comment in reports.service.ts for
     * why this endpoint needs the category check and the balance sheet does
     * not. */
    restrictedForViewer: boolean;
}
interface CashflowStatementDto {
    startDate: string;
    endDate: string;
    operatingInflows: number;
    operatingOutflows: number;
    netOperating: number;
    investingInflows: number;
    investingOutflows: number;
    netInvesting: number;
    openingBalance: number;
    closingBalance: number;
    netChange: number;
}
interface CoaMatrixCell {
    txId: string;
    amount: number;
    description: string | null;
}
interface CoaMatrixDto {
    coaAccountId: string;
    year: number;
    total: number;
    /** Keyed by calendar month (1-12), then day-of-month (1-31). */
    cells: Record<number, Record<number, CoaMatrixCell[]>>;
}

type ExportReportType = "summary" | "bank" | "detail" | "pnl" | "balance-sheet" | "cashflow";
type ExportFormat = "pdf" | "excel";
type ExportJobStatus = "pending" | "processing" | "done" | "failed";
interface ExportJobRequestDto {
    type: ExportReportType;
    format: ExportFormat;
    startDate?: string;
    endDate?: string;
    months?: number;
}
interface ExportJobStatusDto {
    id: string;
    status: ExportJobStatus;
    downloadUrl?: string;
    errorMessage?: string;
}

interface ZakatRequestDto {
    /** Total cash holdings (IDR) */
    cash: number;
    /** Total investment value (IDR) */
    investments: number;
    /** Total gold value (IDR) */
    gold: number;
    /** Total short-term / due liabilities (IDR) */
    liabilities: number;
    /**
     * Whether this wealth has been held for a full lunar year (haul). A
     * balance-sheet snapshot alone can never confirm haul — without it the
     * result is an estimate, not a settled obligation (EPIC-022 E1).
     */
    haulConfirmed: boolean;
    /**
     * Owner-maintained `FamilyGroup.goldPricePerGram` (IDR). When provided,
     * nisab = 85g × this price; when omitted, nisab falls back to an
     * indicative constant (EPIC-022 E2).
     */
    goldPricePerGram?: number;
}
interface ZakatResultDto {
    /** Total zakatable wealth = cash + investments + gold − liabilities */
    zakatable: number;
    /** Nisab threshold (85g gold × the price used — see `nisabSource`) */
    nisab: number;
    /** Zakat amount due (2.5% of zakatable once nisab is met) — an estimate
     * until `isObligated` is also true. */
    zakat: number;
    /** Whether zakatable wealth meets/exceeds nisab (threshold only — does
     * NOT by itself confirm haul). */
    meetsNisab: boolean;
    /** True only when nisab is met AND haul is confirmed by the caller — the
     * actual zakat obligation. Never inferred from the snapshot alone. */
    isObligated: boolean;
    /** Whether nisab was derived from the family's own gold price or the
     * indicative fallback constant. */
    nisabSource: "family" | "indicative";
}
interface PerpuluhanRequestDto {
    /** Gross income for the period (IDR) */
    income: number;
}
interface PerpuluhanResultDto {
    /** The income figure the tithe was computed from */
    income: number;
    /** Perpuluhan due — 10% of income */
    tithe: number;
}
interface Pph21RequestDto {
    /** Annual gross income (IDR) */
    grossIncome: number;
    /** Zakat paid in the year (reduces PKP) */
    zakatPaid?: number;
    /** PTKP override (IDR) for the taxpayer's marital/dependents status. Defaults to TK/0 (Rp 54,000,000) when omitted. */
    ptkp?: number;
}
interface TaxBracketDto {
    /** Bracket label e.g. "0 – 60 Juta" */
    bracket: string;
    /** Taxable amount within this bracket */
    taxableAmount: number;
    /** Tax rate as decimal (e.g. 0.05) */
    rate: number;
    /** Tax due for this bracket */
    tax: number;
}
interface Pph21ResultDto {
    grossIncome: number;
    /** Biaya jabatan deduction (5% of gross, max Rp 6,000,000) */
    biayaJabatan: number;
    /** PTKP deduction (Rp 54,000,000 for TK/0) */
    ptkp: number;
    /** Zakat deduction applied */
    zakatDeduction: number;
    /** Penghasilan Kena Pajak */
    pkp: number;
    /** Per-bracket tax breakdown */
    taxBreakdown: TaxBracketDto[];
    /** Total annual tax */
    totalTax: number;
    /** Effective tax rate (totalTax / grossIncome) */
    effectiveRate: number;
}
interface InvestmentCalcRequestDto {
    /** Present value / initial investment (IDR) */
    pv: number;
    /** Periodic payment / regular contribution (IDR) */
    pmt: number;
    /** Annual interest/return rate as decimal (e.g. 0.12 for 12%) */
    rate: number;
    /** Investment duration in years */
    years: number;
    /** Number of compounding periods per year (default: 12) */
    compoundsPerYear?: number;
}
interface InvestmentCalcResultDto {
    /** Future value */
    futureValue: number;
    /** Total amount contributed (pv + pmt × total periods) */
    totalContributions: number;
    /** Total interest/gain earned */
    totalInterest: number;
}
interface KprCalcRequestDto {
    /** Principal loan amount (IDR) */
    principal: number;
    /** Annual interest rate as decimal (e.g. 0.07 for 7%) */
    annualRate: number;
    /** Loan duration in years */
    years: number;
}
interface KprCalcResultDto {
    /** Monthly instalment payment (IDR) */
    monthlyPayment: number;
    /** Total amount paid over the full term */
    totalPayment: number;
    /** Total interest paid */
    totalInterest: number;
}
interface RetirementCalcRequestDto {
    /** Target retirement fund (IDR) */
    targetAmount: number;
    /** Years until retirement */
    years: number;
    /** Annual investment return rate as decimal */
    annualRate: number;
    /** Existing savings already accumulated (IDR, default: 0) */
    existingAmount?: number;
}
interface RetirementCalcResultDto {
    /** Required monthly contribution to reach target */
    monthlyContribution: number;
    /** Total contributions over the period */
    totalContributions: number;
    /** Projected final value (existing + contributions + growth) */
    projectedValue: number;
}

type DonationType = "zakat_maal" | "zakat_fitrah" | "infaq" | "sedekah" | "wakaf" | "persepuluhan" | "lainnya";
interface DonationDto {
    id: string;
    familyGroupId: string;
    type: DonationType;
    recipient: string;
    amount: string;
    currency: string;
    donatedAt: string;
    isTaxDeductible: boolean;
    accountId: string | null;
    transactionId: string | null;
    receiptUrl: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
}
interface CreateDonationDto {
    type: DonationType;
    recipient: string;
    amount: string;
    currency?: string;
    donatedAt: string;
    isTaxDeductible?: boolean;
    accountId?: string;
    receiptUrl?: string;
    notes?: string;
}
interface UpdateDonationDto {
    type?: DonationType;
    recipient?: string;
    amount?: string;
    currency?: string;
    donatedAt?: string;
    isTaxDeductible?: boolean;
    receiptUrl?: string;
    notes?: string;
}

type SptStatus = "belum_lapor" | "sudah_lapor" | "terlambat";
interface TaxRecordDto {
    id: string;
    familyGroupId: string;
    taxYear: number;
    grossIncome: string;
    ptkp: string;
    zakatDeduction: string;
    netTax: string;
    sptStatus: SptStatus;
    documentUrl: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
    calcMode: TaxCalcMode;
    maritalStatus: TaxMaritalStatus | null;
    dependents: number | null;
    pensionContribution: string | null;
    freelanceGross: string | null;
    nppnRateBps: number | null;
    otherNetIncome: string | null;
    withheldPph21: string | null;
    /** netTax − (withheldPph21 ?? 0) */
    balance: string;
    sptFiledAt: string | null;
    rules: TaxRuleRefDto[];
}
interface CreateTaxRecordDto {
    taxYear: number;
    grossIncome: string;
    ptkp?: string;
    netTax?: string;
    sptStatus?: SptStatus;
    documentUrl?: string;
    notes?: string;
    maritalStatus?: TaxMaritalStatus;
    dependents?: number;
    pensionContribution?: string;
    freelanceGross?: string;
    nppnRateBps?: number;
    otherNetIncome?: string;
    withheldPph21?: string;
}
interface UpdateTaxRecordDto {
    taxYear?: number;
    grossIncome?: string;
    ptkp?: string;
    netTax?: string;
    sptStatus?: SptStatus;
    documentUrl?: string;
    notes?: string;
    maritalStatus?: TaxMaritalStatus;
    dependents?: number;
    pensionContribution?: string;
    freelanceGross?: string;
    nppnRateBps?: number;
    otherNetIncome?: string;
    withheldPph21?: string;
}
type TaxMaritalStatus = "TK" | "K" | "KI";
type TaxCalcMode = "legacy" | "detailed";
type TerCategory = "A" | "B" | "C";
type DtpSector = "alas_kaki" | "tekstil_pakaian" | "furnitur" | "kulit" | "pariwisata";
type DtpEmployment = "permanent" | "non_permanent";
type DtpReason = "no_program" | "sector_not_covered" | "gross_above_cap" | "daily_wage_above_cap" | "nik_not_validated";
type TaxFinalInstrument = "bunga_deposito" | "bunga_tabungan" | "dividen" | "saham_idx" | "kupon_sbn" | "reksa_dana" | "p2p" | "kripto_domestik" | "kripto_luar" | "emas" | "sewa";
type CryptoExchangeKind = "domestik" | "luar_negeri";
interface TaxRuleRefDto {
    key: string;
    legalBasis: string;
    source: string | null;
    verified: boolean;
    effectiveFrom: string;
    effectiveTo: string | null;
    outOfRange: boolean;
    note: string | null;
}
/** Public GET /calculators/tax-rules: the ref plus its value (BigInt fields as digit strings). */
interface TaxRuleDetailDto extends TaxRuleRefDto {
    value: unknown;
}
interface PphOpPreviewRequestDto {
    taxYear: number;
    maritalStatus: TaxMaritalStatus;
    dependents: number;
    employmentGross: string;
    pensionContribution?: string;
    freelanceGross?: string;
    nppnRateBps?: number;
    otherNetIncome?: string;
    zakat?: string;
    withheldPph21?: string;
}
interface PphOpBracketDto {
    from: string;
    upTo: string | null;
    rateBps: number;
    label: string;
    taxable: string;
    tax: string;
}
interface PphOpResultDto {
    taxYear: number;
    ptkp: string;
    biayaJabatan: string;
    pensionDeduction: string;
    freelanceNet: string;
    neto: string;
    zakatApplied: string;
    pkp: string;
    brackets: PphOpBracketDto[];
    tax: string;
    withheld: string;
    /** tax − withheld; negative = lebih bayar */
    balance: string;
    rules: TaxRuleRefDto[];
}
interface TerPreviewRequestDto {
    taxYear: number;
    maritalStatus: TaxMaritalStatus;
    dependents: number;
    monthlyGross: string[];
    monthlyPension?: string[];
    /** Fixed/regular monthly gross (excl. THR/bonus); used only for the DTP
     * salary cap (PMK 10/2025, 105/2025). Defaults to monthlyGross per month. */
    monthlyFixedGross?: string[];
    zakat?: string;
    dtp?: {
        sector: DtpSector | null;
        employment: DtpEmployment;
        dailyWage?: string | null;
        nikValidated: boolean;
    } | null;
}
interface TerMonthDto {
    month: number;
    gross: string;
    category: TerCategory;
    rateBps: number | null;
    withholding: string;
    dtp: {
        eligible: boolean;
        reasons: DtpReason[];
        amount: string;
    } | null;
}
interface TerPreviewResultDto {
    category: TerCategory;
    months: TerMonthDto[];
    annualTax: string;
    withheldJanNov: string;
    december: string;
    isRefund: boolean;
    dtpTotal: string;
    rules: TaxRuleRefDto[];
}
interface UmkmPreviewRequestDto {
    taxYear: number;
    monthlyOmzet: string[];
    firstRegisteredYear?: number | null;
}
interface UmkmMonthDto {
    month: number;
    omzet: string;
    cumulative: string;
    taxable: string;
    tax: string | null;
    eligible: boolean;
}
interface UmkmResultDto {
    taxYear: number;
    months: UmkmMonthDto[];
    totalOmzet: string;
    totalTax: string;
    exceedsCeiling: boolean;
    ineligibleReason: "time_limit" | null;
    firstRegisteredYear: number | null;
    saved: boolean;
    rules: TaxRuleRefDto[];
}
interface PpnPreviewRequestDto {
    date: string;
    amount: string;
    luxury: boolean;
    priceIncludesPpn: boolean;
}
interface PpnPreviewResultDto {
    priceExcludingPpn: string;
    dpp: string;
    ppn: string;
    totalWithPpn: string;
    nominalBps: number;
    effectiveBps: number;
    rules: TaxRuleRefDto[];
}
interface TaxFinalIncomeEntryDto {
    id: string;
    taxYear: number;
    instrument: TaxFinalInstrument;
    grossAmount: string;
    occurredAt: string;
    reinvested: boolean;
    rateBpsOverride: number | null;
    investmentId: string | null;
    accountId: string | null;
    notes: string | null;
}
interface CreateTaxFinalIncomeEntryDto {
    instrument: TaxFinalInstrument;
    grossAmount: string;
    occurredAt: string;
    reinvested?: boolean;
    rateBpsOverride?: number | null;
    investmentId?: string | null;
    accountId?: string | null;
    notes?: string | null;
}
type UpdateTaxFinalIncomeEntryDto = Partial<CreateTaxFinalIncomeEntryDto>;
interface FinalTaxLineDto {
    source: "holding" | "entry";
    instrument: TaxFinalInstrument;
    label: string;
    investmentId: string | null;
    accountId: string | null;
    entryId: string | null;
    /** `YYYY-MM-DD` for a stored `entry` line (editable); null for a computed `holding` line. */
    occurredAt: string | null;
    grossAmount: string;
    rateBps: number | null;
    tax: string | null;
    rateSource: "rule" | "override" | "missing";
    belowThreshold: boolean;
    /** Machine-readable caveat, rendered via i18n: "assumed_domestic" | "assumed_sbn" | "no_purchase_date" | "no_interest_rate" | null */
    caveat: "assumed_domestic" | "assumed_sbn" | "no_purchase_date" | "no_interest_rate" | null;
    rule: TaxRuleRefDto;
}
interface FinalTaxEstimateDto {
    taxYear: number;
    lines: FinalTaxLineDto[];
    totalTax: string;
    missingRateCount: number;
    skippedForeign: number;
}
interface SptTimingDto {
    status: SptStatus | null;
    deadline: string;
    graceUntil: string | null;
    daysToDeadline: number;
    pastDeadline: boolean;
    withinGrace: boolean;
    filedAt: string | null;
}
interface TaxAnnualSummaryDto {
    taxYear: number;
    pphOp: {
        recordId: string;
        calcMode: TaxCalcMode;
        tax: string;
        withheld: string;
        balance: string;
    } | null;
    finalTax: {
        totalTax: string;
        lineCount: number;
        missingRateCount: number;
    };
    umkm: {
        totalTax: string;
        exceedsCeiling: boolean;
        ineligibleReason: "time_limit" | null;
    } | null;
    totalEstimatedTax: string;
    spt: SptTimingDto;
    rules: TaxRuleRefDto[];
}
/** Hardening batch G2 — a document uploaded for a family's tax year. */
interface TaxDocumentDto {
    id: string;
    taxYear: number;
    mimeType: string;
    size: number;
    createdAt: string;
}

/**
 * EPIC-024 Task J (D14, US-MD-1) — the seven reference lists (bank, e-wallet,
 * transaction type, investment type, donation institution, asset category,
 * insurance type) that used to be hardcoded arrays in `masterdata/page.tsx`
 * ("Master data is a client-side illusion" — Evidence section). This is the
 * single source of truth for the group ids and their seed defaults, shared
 * by the API (`auth.service.ts` registration, the web Better-Auth hook, and
 * the backfill migration comment) and the web `masterdata` page.
 *
 * "Kategori" is NOT part of this — it already has its own real API/table
 * (`Category`) and stays that way (see `categories/index.ts`).
 */
declare const ReferenceItemGroupSchema: z.ZodEnum<["bank", "ewallet", "txntype", "invtype", "lembaga", "asettype", "instype"]>;
type ReferenceItemGroup = z.infer<typeof ReferenceItemGroupSchema>;
declare const ACTIVE_REFERENCE_ITEM_GROUPS: readonly ["bank", "ewallet", "lembaga"];
type ActiveReferenceItemGroup = (typeof ACTIVE_REFERENCE_ITEM_GROUPS)[number];
declare const CreateReferenceItemDtoSchema: z.ZodObject<{
    group: z.ZodEnum<["bank", "ewallet", "txntype", "invtype", "lembaga", "asettype", "instype"]>;
    label: z.ZodString;
}, "strip", z.ZodTypeAny, {
    group: "bank" | "ewallet" | "txntype" | "invtype" | "lembaga" | "asettype" | "instype";
    label: string;
}, {
    group: "bank" | "ewallet" | "txntype" | "invtype" | "lembaga" | "asettype" | "instype";
    label: string;
}>;
type CreateReferenceItemDto = z.infer<typeof CreateReferenceItemDtoSchema>;
declare const ReferenceItemDtoSchema: z.ZodObject<{
    id: z.ZodString;
    familyGroupId: z.ZodString;
    group: z.ZodEnum<["bank", "ewallet", "txntype", "invtype", "lembaga", "asettype", "instype"]>;
    label: z.ZodString;
    sortOrder: z.ZodNumber;
    isSystem: z.ZodBoolean;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    familyGroupId: string;
    createdAt: string;
    group: "bank" | "ewallet" | "txntype" | "invtype" | "lembaga" | "asettype" | "instype";
    label: string;
    sortOrder: number;
    isSystem: boolean;
}, {
    id: string;
    familyGroupId: string;
    createdAt: string;
    group: "bank" | "ewallet" | "txntype" | "invtype" | "lembaga" | "asettype" | "instype";
    label: string;
    sortOrder: number;
    isSystem: boolean;
}>;
type ReferenceItemDto = z.infer<typeof ReferenceItemDtoSchema>;
/**
 * Seed defaults per group, in display order — ported verbatim from the old
 * `REFERENCE_GROUPS` local array (`masterdata/page.tsx`). `sortOrder` is the
 * array index, so seeded rows keep the same order the demo always showed.
 */
declare const REFERENCE_ITEM_DEFAULTS: Record<ActiveReferenceItemGroup, readonly string[]>;
type ReferenceItemSeedEntry = {
    group: ReferenceItemGroup;
    label: string;
    sortOrder: number;
};
/**
 * Flattened seed rows in `(familyGroupId, group, label, sortOrder, isSystem: true)`
 * shape, for `createMany` at registration. Kept as a function (not a static
 * array) purely for a fresh `sortOrder` sequence per group — the content is
 * static.
 */
declare function buildReferenceItemSeed(): ReferenceItemSeedEntry[];

/**
 * EPIC-024 Task L (D15, US-TXN-9) — shared contract for transaction
 * attachments (receipts/photos). Mirrors
 * `apps/api/src/attachments/dto/transaction-attachment-response.dto.ts`
 * exactly: NO `filename`/`path` field — the storage key is an internal
 * detail, and the server never trusts a client-supplied filename (MIME is
 * sniffed server-side from the file's own bytes, not the client's
 * Content-Type). The UI derives a display label from `mimeType` alone.
 */
declare const TransactionAttachmentDtoSchema: z.ZodObject<{
    id: z.ZodString;
    transactionId: z.ZodString;
    mimeType: z.ZodString;
    size: z.ZodNumber;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    transactionId: string;
    mimeType: string;
    size: number;
}, {
    id: string;
    createdAt: string;
    transactionId: string;
    mimeType: string;
    size: number;
}>;
type TransactionAttachmentDto = z.infer<typeof TransactionAttachmentDtoSchema>;
/**
 * Client-side pre-check constants — MUST match the server's authoritative
 * limits (`attachments.controller.ts`'s `MAX_ATTACHMENT_FILE_BYTES`,
 * `attachments.service.ts`'s `detectAllowedMime`/`extensionForMime`). The
 * server is the source of truth; this only lets the UI reject an obviously
 * bad file before spending an upload round-trip.
 */
declare const ATTACHMENT_MAX_FILE_BYTES: number;
declare const ATTACHMENT_ACCEPTED_MIME_TYPES: readonly ["image/jpeg", "image/png", "image/webp", "application/pdf"];
type AttachmentAcceptedMimeType = (typeof ATTACHMENT_ACCEPTED_MIME_TYPES)[number];

/**
 * EPIC-030 — IAM page access. One catalog shared by web (menu, route guard,
 * IAM matrix) and API (PageAccessGuard, CASL), so both sides always agree on
 * what a member may open.
 *
 * Only pages a Master may grant are listed. Always open to every member (not
 * configurable): akun, akses-saya, notifikasi (personal), panduan (help).
 * `iam` is Master-only and deliberately NOT in this catalog — granting it
 * would let a member raise their own access.
 */
declare const ACCESS_PAGES: readonly ["beranda", "ringkasan", "transaksi", "anggaran", "laporan", "tujuan", "dana", "rekening", "investasi", "aset", "liabilitas", "asuransi", "warisan", "donation", "tax", "persetujuan", "splitbill", "rekonsiliasi", "ai", "kalkulator", "mastercoa", "masterdata"];
declare const AccessPageSchema: z.ZodEnum<["beranda", "ringkasan", "transaksi", "anggaran", "laporan", "tujuan", "dana", "rekening", "investasi", "aset", "liabilitas", "asuransi", "warisan", "donation", "tax", "persetujuan", "splitbill", "rekonsiliasi", "ai", "kalkulator", "mastercoa", "masterdata"]>;
type AccessPage = z.infer<typeof AccessPageSchema>;
/** Routes every signed-in member may open regardless of access. */
declare const ALWAYS_OPEN_PAGES: readonly ["akun", "akses-saya", "notifikasi", "panduan"];
declare const ACCESS_LEVELS: readonly ["none", "view", "manage"];
declare const AccessLevelSchema: z.ZodEnum<["none", "view", "manage"]>;
type AccessLevel = z.infer<typeof AccessLevelSchema>;
/** `all` = the whole family's data; `own` = only rows the member owns/created. */
declare const AccessDataScopeSchema: z.ZodEnum<["all", "own"]>;
type AccessDataScope = z.infer<typeof AccessDataScopeSchema>;
/** Sparse page → level map. A page that is absent means `none`. */
declare const AccessPermissionsSchema: z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodEnum<["none", "view", "manage"]>>, Partial<Record<"beranda" | "ringkasan" | "transaksi" | "anggaran" | "laporan" | "tujuan" | "dana" | "rekening" | "investasi" | "aset" | "liabilitas" | "asuransi" | "warisan" | "donation" | "tax" | "persetujuan" | "splitbill" | "rekonsiliasi" | "ai" | "kalkulator" | "mastercoa" | "masterdata", "none" | "view" | "manage">>, Record<string, "none" | "view" | "manage">>;
type AccessPermissions = Partial<Record<AccessPage, AccessLevel>>;
type MemberRoleKey = "owner" | "spouse" | "member" | "admin_staff" | "dependant" | "operational";
/**
 * What each built-in role could reach before EPIC-030 (nav.ts allowlists +
 * casl-ability.factory.ts). A member with no custom role and no overrides
 * resolves to exactly this, so nobody's access changes until the Master
 * assigns something.
 */
declare const LEGACY_ACCESS_PRESETS: Record<Exclude<MemberRoleKey, "owner">, {
    permissions: AccessPermissions;
    dataScope: AccessDataScope;
}>;
type EffectiveAccess = {
    /** Master: bypasses every page check. */
    isMaster: boolean;
    permissions: Record<AccessPage, AccessLevel>;
    dataScope: AccessDataScope;
    /** Where the base came from — shown on /iam. */
    source: "master" | "custom-role" | "legacy";
    /** Member has at least one per-member override on top of the base. */
    hasOverrides: boolean;
    /**
     * The member's real built-in role — kept separate from `permissions`
     * because pages like `quickinput` (Master & Co-Master only) are gated on
     * WHO the member is, not on any grantable page permission. Never derived
     * from `accessRole`/`overrides`.
     */
    role: MemberRoleKey;
};
/** Master (`owner`) or Co-Master (`spouse`) — see `EffectiveAccess.role`. */
declare function isMasterOrCoMaster(role: MemberRoleKey | string | null | undefined): boolean;
declare function levelAtLeast(have: AccessLevel, need: AccessLevel): boolean;
/**
 * Master → full. Otherwise: custom role's map (or the legacy preset of the
 * built-in role when none is assigned), then per-member overrides on top.
 * Pure — the API and web both call this, so they cannot disagree.
 */
declare function resolveEffectiveAccess(input: {
    role: MemberRoleKey;
    accessRole?: {
        permissions: AccessPermissions;
        dataScope: AccessDataScope;
    } | null;
    overrides?: AccessPermissions | null;
}): EffectiveAccess;
declare function canAccessPage(access: EffectiveAccess, page: AccessPage, need?: AccessLevel): boolean;
declare const AccessRoleInputSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    dataScope: z.ZodEnum<["all", "own"]>;
    permissions: z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodEnum<["none", "view", "manage"]>>, Partial<Record<"beranda" | "ringkasan" | "transaksi" | "anggaran" | "laporan" | "tujuan" | "dana" | "rekening" | "investasi" | "aset" | "liabilitas" | "asuransi" | "warisan" | "donation" | "tax" | "persetujuan" | "splitbill" | "rekonsiliasi" | "ai" | "kalkulator" | "mastercoa" | "masterdata", "none" | "view" | "manage">>, Record<string, "none" | "view" | "manage">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    dataScope: "all" | "own";
    permissions: Partial<Record<"beranda" | "ringkasan" | "transaksi" | "anggaran" | "laporan" | "tujuan" | "dana" | "rekening" | "investasi" | "aset" | "liabilitas" | "asuransi" | "warisan" | "donation" | "tax" | "persetujuan" | "splitbill" | "rekonsiliasi" | "ai" | "kalkulator" | "mastercoa" | "masterdata", "none" | "view" | "manage">>;
    description?: string | null | undefined;
}, {
    name: string;
    dataScope: "all" | "own";
    permissions: Record<string, "none" | "view" | "manage">;
    description?: string | null | undefined;
}>;
type AccessRoleInput = z.infer<typeof AccessRoleInputSchema>;
type AccessRoleResponse = {
    id: string;
    name: string;
    description: string | null;
    dataScope: AccessDataScope;
    permissions: AccessPermissions;
    memberCount: number;
    createdAt: string;
};
declare const MemberAccessInputSchema: z.ZodObject<{
    /** null = no custom role (use the built-in role's preset). */
    accessRoleId: z.ZodNullable<z.ZodString>;
    /** Sparse overrides on top of the role; {} clears them. */
    overrides: z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodEnum<["none", "view", "manage"]>>, Partial<Record<"beranda" | "ringkasan" | "transaksi" | "anggaran" | "laporan" | "tujuan" | "dana" | "rekening" | "investasi" | "aset" | "liabilitas" | "asuransi" | "warisan" | "donation" | "tax" | "persetujuan" | "splitbill" | "rekonsiliasi" | "ai" | "kalkulator" | "mastercoa" | "masterdata", "none" | "view" | "manage">>, Record<string, "none" | "view" | "manage">>;
}, "strip", z.ZodTypeAny, {
    accessRoleId: string | null;
    overrides: Partial<Record<"beranda" | "ringkasan" | "transaksi" | "anggaran" | "laporan" | "tujuan" | "dana" | "rekening" | "investasi" | "aset" | "liabilitas" | "asuransi" | "warisan" | "donation" | "tax" | "persetujuan" | "splitbill" | "rekonsiliasi" | "ai" | "kalkulator" | "mastercoa" | "masterdata", "none" | "view" | "manage">>;
}, {
    accessRoleId: string | null;
    overrides: Record<string, "none" | "view" | "manage">;
}>;
type MemberAccessInput = z.infer<typeof MemberAccessInputSchema>;
type MyAccessResponse = EffectiveAccess;

/**
 * EPIC-031 — family-scoped login IDs.
 *
 * A member the Master creates signs in as `<username>@<familyHandle>`
 * (e.g. `budi@arsandi`). The username only has to be unique inside one
 * family; the family handle ("kode keluarga") is unique app-wide. The full
 * login ID is what is stored in `User.username`, so better-auth's own
 * `/sign-in/username` finds it without any custom lookup.
 *
 * The handle never contains a dot, so a login ID can never be mistaken for
 * an email address (every real email domain has one).
 */
/** Username part: 3–30 of a–z 0–9 _ . (better-auth's own username charset). */
declare const MEMBER_USERNAME_PATTERN: RegExp;
/** Family handle: 3–24 of a–z 0–9 -, starting/ending alphanumeric, no dot. */
declare const FAMILY_HANDLE_PATTERN: RegExp;
/**
 * Everything `User.username` may hold: a legacy plain username (created
 * before EPIC-031, still valid) or a family login ID.
 */
declare const LOGIN_USERNAME_PATTERN: RegExp;
declare const MAX_LOGIN_USERNAME_LENGTH: number;
declare function buildFamilyLoginId(username: string, handle: string): string;
/** `budi@arsandi` → true; `budi@gmail.com` / `budi` → false. */
declare function isFamilyLoginId(input: string): boolean;
/** Suggested handle from a family / person name: "Irfan Arsandi's Family" → "irfan". */
declare function slugifyHandleBase(name: string): string;

/** Revisi I — the input/display currency universe (matches apps/web/src/hooks/currencies.ts). */
declare const FX_CURRENCY_CODES: readonly ["IDR", "USD", "SGD", "EUR", "JPY", "AUD", "CNY"];
type FxCurrencyCode = (typeof FX_CURRENCY_CODES)[number];
type ForeignFxCurrencyCode = Exclude<FxCurrencyCode, "IDR">;
declare const FOREIGN_FX_CURRENCY_CODES: ForeignFxCurrencyCode[];
/** ISO 4217 minor-unit digits. IDR and JPY have none. */
declare const FX_CURRENCY_DECIMALS: Record<FxCurrencyCode, number>;
/** Rates travel as IDR-per-1-unit decimal strings with this many decimals. */
declare const FX_RATE_SCALE = 6;

declare function isFxCurrency(value: string): value is FxCurrencyCode;
declare function parseScaled(value: string, scale: number): bigint;
declare function parseMinor(amount: string, currency: FxCurrencyCode): bigint;
/** Integer division rounding half away from zero (round-half-up on magnitude). */
declare function divRoundHalfUp(n: bigint, d: bigint): bigint;
declare function formatScaled(value: bigint, scale: number): string;
/** `amount` (canonical decimal in `currency`) → IDR at `targetScale` (0 = whole rupiah, 2 = sen). */
declare function convertToIdr(input: {
    amount: string;
    currency: FxCurrencyCode;
    idrPerUnit: string;
    targetScale: 0 | 2;
}): bigint;
/** IDR per 1 unit of X from two EUR-based ECB quotes, at FX_RATE_SCALE. */
declare function deriveIdrPerUnit(eurToIdr: string, eurToX: string): string;

declare const FxCurrencyCodeSchema: z.ZodEnum<["IDR", "USD", "SGD", "EUR", "JPY", "AUD", "CNY"]>;
/** One money field typed in a foreign currency; the server converts it and overwrites `field`. */
declare const FxInputSchema: z.ZodObject<{
    field: z.ZodString;
    currency: z.ZodEnum<["USD", "SGD", "EUR", "JPY", "AUD", "CNY"]>;
    amount: z.ZodString;
}, "strip", z.ZodTypeAny, {
    currency: "USD" | "SGD" | "EUR" | "JPY" | "AUD" | "CNY";
    amount: string;
    field: string;
}, {
    currency: "USD" | "SGD" | "EUR" | "JPY" | "AUD" | "CNY";
    amount: string;
    field: string;
}>;
type FxInput = z.infer<typeof FxInputSchema>;
declare const FxRatesResponseSchema: z.ZodObject<{
    base: z.ZodString;
    rates: z.ZodRecord<z.ZodString, z.ZodNumber>;
    rateDate: z.ZodString;
    source: z.ZodEnum<["frankfurter", "indicative"]>;
    stale: z.ZodBoolean;
    idrPerUnit: z.ZodRecord<z.ZodString, z.ZodString>;
}, "strip", z.ZodTypeAny, {
    source: "indicative" | "frankfurter";
    base: string;
    rates: Record<string, number>;
    rateDate: string;
    stale: boolean;
    idrPerUnit: Record<string, string>;
}, {
    source: "indicative" | "frankfurter";
    base: string;
    rates: Record<string, number>;
    rateDate: string;
    stale: boolean;
    idrPerUnit: Record<string, string>;
}>;
type FxRatesResponse = z.infer<typeof FxRatesResponseSchema>;

/** The ten canonical asset classes shown everywhere a category/type badge renders. */
type AssetClassKey = "properti" | "kendaraan" | "kas_tabungan" | "deposito" | "saham" | "reksa_dana" | "obligasi" | "emas" | "kripto" | "lainnya";
/** Display order used by every "Kategori" filter/legend built from this taxonomy. */
declare const ASSET_CLASS_KEYS: readonly AssetClassKey[];
/**
 * Mirrors Prisma's `AssetType` enum (apps/api/prisma/schema.prisma) —
 * /aset physical-asset types. `elektronik` and `perhiasan` are real,
 * separately-stored types (unchanged) that fold into the coarser "lainnya"
 * display bucket, matching the brief's canonical list (which has no
 * Elektronik/Perhiasan entry of its own).
 */
declare function assetTypeToAssetClass(type: string): AssetClassKey;
/** Mirrors Prisma's `InvestmentType` enum — /investasi instrument types. */
declare function investmentTypeToAssetClass(type: string): AssetClassKey;
/**
 * Mirrors Prisma's `AccountType` enum — used for the "Dana & Rekening"
 * cash-like accounts shown alongside physical assets/investments on /aset.
 * `investment` here means a brokerage CASH sub-account (not a holding), so
 * it buckets with everyday liquid funds, not `saham`.
 */
declare function accountTypeToAssetClass(type: string): AssetClassKey;
/**
 * `InheritanceAsset.assetType` is a free-text string (never a DB enum), so
 * there is nothing to migrate — this mapper only normalizes DISPLAY. Known
 * legacy option strings (`warisan/page.tsx`'s historical `ASSET_TYPE_OPTIONS`)
 * map exactly; anything else (a typo, a pre-taxonomy custom entry) falls
 * back to "lainnya" rather than crashing or showing a blank category.
 */
declare function warisanAssetTypeToAssetClass(assetType: string): AssetClassKey;

export { ACCESS_LEVELS, ACCESS_PAGES, ACTIVE_REFERENCE_ITEM_GROUPS, ALWAYS_OPEN_PAGES, ASSET_CLASS_KEYS, ATTACHMENT_ACCEPTED_MIME_TYPES, ATTACHMENT_MAX_FILE_BYTES, type AccessDataScope, AccessDataScopeSchema, type AccessLevel, AccessLevelSchema, type AccessPage, AccessPageSchema, type AccessPermissions, AccessPermissionsSchema, type AccessRoleInput, AccessRoleInputSchema, type AccessRoleResponse, type AccountDto, AccountDtoSchema, type AccountOwnerFilter, AccountOwnerFilterSchema, type AccountSummaryItemDto, type AccountType, AccountTypeSchema, type ActiveReferenceItemGroup, type AllocationItemDto, type AllowanceRequestDto, AllowanceRequestDtoSchema, type AllowanceRequestKind, AllowanceRequestKindSchema, type AllowanceRequestStatus, AllowanceRequestStatusSchema, AllowedCategoryDtoSchema, type ApproveAllowanceRequestInput, ApproveAllowanceRequestInputSchema, type AssetAttachmentDto, type AssetClassKey, type AssetDto, type AssetHistoryDto, type AssetTypeId, type AssetValueChangeMode, type AttachmentAcceptedMimeType, type AuthUser, AuthUserSchema, type BalanceSheetDto, type BankBreakdownItem, type BankReportDto, type BudgetDto, type BudgetPeriod, type BudgetType, CONTRACTS_VERSION, type CashflowDto, type CashflowStatementDto, type CategoryBreakdownItem, type CategoryDto, CategoryDtoSchema, type CategoryKind, CategoryKindSchema, type CoaChartBudgetType, type CoaChartDirection, type CoaChartEntry, type CoaMatrixCell, type CoaMatrixDto, type CreateAccountInput, CreateAccountInputSchema, type CreateAllowanceRequestInput, CreateAllowanceRequestInputSchema, type CreateAssetDto, type CreateBudgetDto, type CreateDonationDto, type CreateGoalContributionInput, CreateGoalContributionInputSchema, type CreateGoalDto, type CreateHeirDto, type CreateInheritanceAssetDto, type CreateInsuranceBeneficiaryDto, type CreateInsuranceDto, type CreateLiabilityDto, type CreateLiabilityFloatingRateDto, type CreateReferenceItemDto, CreateReferenceItemDtoSchema, type CreateSplitBillDto, type CreateSplitParticipantDto, type CreateTaxFinalIncomeEntryDto, type CreateTaxRecordDto, type CreateTransactionInput, CreateTransactionInputSchema, type CryptoExchangeKind, DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT, DEFAULT_ROLE_BY_RELATIONSHIP, type DashboardSummaryDto, type DetailReportDto, type DetailTransactionItem, type DonationDto, type DonationType, type DtpEmployment, type DtpReason, type DtpSector, type EffectiveAccess, type ExportFormat, type ExportJobRequestDto, type ExportJobStatus, type ExportJobStatusDto, type ExportReportType, FAMILY_HANDLE_PATTERN, FOREIGN_FX_CURRENCY_CODES, FX_CURRENCY_CODES, FX_CURRENCY_DECIMALS, FX_RATE_SCALE, type FinalTaxEstimateDto, type FinalTaxLineDto, type ForeignFxCurrencyCode, type FxCurrencyCode, FxCurrencyCodeSchema, type FxInput, FxInputSchema, type FxRatesResponse, FxRatesResponseSchema, GENERIC_COA_CHART, type GoalContributionDto, GoalContributionDtoSchema, type GoalContributionResult, type GoalContributionSource, GoalContributionSourceSchema, type GoalDto, type GoalStatus, type HeldExpenseResponse, HeldExpenseResponseSchema, type InheritanceAssetDto, type InheritanceHeirDto, type InheritanceVisibility, type InsuranceBeneficiaryDto, type InsuranceDto, type InsuranceStatus, type InsuranceSummaryDto, type InsuranceType, type InterestMethod, type InvestmentCalcRequestDto, type InvestmentCalcResultDto, type InvestmentDto, type InvestmentPriceDto, type InvestmentSummaryDto, type InvestmentTransactionDto, type InvestmentTxType, type InvestmentType, type KprCalcRequestDto, type KprCalcResultDto, type KprScheme, LEGACY_ACCESS_PRESETS, LOGIN_USERNAME_PATTERN, type LiabilityDto, type LiabilityFloatingRateDto, type LiabilityPaymentPreviewDto, type LiabilityPrepaymentDto, type LiabilityPrepaymentPreviewDto, type LiabilityPrepaymentRecordResultDto, type LiabilityRateBandDto, type LiabilityRatePeriodDto, type LiabilityScheduleDto, type LiabilityScheduleRowDto, type LiabilitySummaryDto, type LiabilityType, type LoginInput, LoginInputSchema, MAX_LOGIN_USERNAME_LENGTH, MEMBER_USERNAME_PATTERN, type MemberAccessInput, MemberAccessInputSchema, type MemberCategoryAllowanceDto, MemberCategoryAllowanceDtoSchema, type MemberRelationship, MemberRelationshipSchema, type MemberRoleKey, type MyAccessResponse, type NetWorthDto, type NetWorthHistoryDto, type NetWorthHistoryPointDto, type NotificationDto, type ParticipantStatus, type PeriodPoint, type PerpuluhanRequestDto, type PerpuluhanResultDto, type PnlDto, type Pph21RequestDto, type Pph21ResultDto, type PphOpBracketDto, type PphOpPreviewRequestDto, type PphOpResultDto, type PpnPreviewRequestDto, type PpnPreviewResultDto, type PremiumPeriod, type PrepaymentMode, type PublicSplitParticipantDto, REFERENCE_ITEM_DEFAULTS, type RatePeriodKind, type ReconciliationBridgeDto, type RecordLiabilityPrepaymentDto, type ReferenceItemDto, ReferenceItemDtoSchema, type ReferenceItemGroup, ReferenceItemGroupSchema, type ReferenceItemSeedEntry, type RejectAllowanceRequestInput, RejectAllowanceRequestInputSchema, type ReportPeriod, type ReportSummaryDto, type RetirementCalcRequestDto, type RetirementCalcResultDto, type Role, RoleSchema, type Rupiah, RupiahSchema, type SankeyDto, type SankeyLink, type SankeyNode, type SearchResponseDto, type SearchResultDto, type SearchResultType, type SetMemberCategoryAllowanceInput, SetMemberCategoryAllowanceInputSchema, type SplitBillDto, type SplitBillPayoutDto, type SplitParticipantDto, type SplitStatus, type SptStatus, type SptTimingDto, type TaxAnnualSummaryDto, type TaxBracketDto, type TaxCalcMode, type TaxDocumentDto, type TaxFinalIncomeEntryDto, type TaxFinalInstrument, type TaxMaritalStatus, type TaxRecordDto, type TaxRuleDetailDto, type TaxRuleRefDto, type TerCategory, type TerMonthDto, type TerPreviewRequestDto, type TerPreviewResultDto, type TransactionAttachmentDto, TransactionAttachmentDtoSchema, type TransactionDto, TransactionDtoSchema, type TransactionListResponse, TransactionListResponseSchema, type TransactionSummary, TransactionSummarySchema, type TransactionType, TransactionTypeSchema, type UmkmMonthDto, type UmkmPreviewRequestDto, type UmkmResultDto, type UpdateAccountInput, UpdateAccountInputSchema, type UpdateAssetDto, type UpdateBudgetDto, type UpdateDonationDto, type UpdateGoalDto, type UpdateInheritanceAssetDto, type UpdateInsuranceDto, type UpdateLiabilityDto, type UpdatePayoutAccountDto, type UpdateTaxFinalIncomeEntryDto, type UpdateTaxRecordDto, type ZakatRequestDto, type ZakatResultDto, accountTypeToAssetClass, assetTypeToAssetClass, buildFamilyLoginId, buildReferenceItemSeed, canAccessPage, convertToIdr, defaultCoaCodeForCategory, defaultRoleForRelationship, deriveIdrPerUnit, divRoundHalfUp, formatScaled, investmentTypeToAssetClass, isFamilyLoginId, isFxCurrency, isMasterOrCoMaster, levelAtLeast, parseMinor, parseScaled, resolveEffectiveAccess, slugifyHandleBase, warisanAssetTypeToAssetClass };
