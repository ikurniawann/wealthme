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
interface NetWorthDto {
    accountsTotal: string;
    investmentsTotal: string;
    assetsTotal: string;
    liabilitiesTotal: string;
    netWorth: string;
    currency: string;
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

interface AssetDto {
    id: string;
    familyGroupId: string;
    name: string;
    type: string;
    currentValue: string;
    currency: string;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
}
interface AssetHistoryDto {
    id: string;
    assetId: string;
    value: string;
    recordedAt: string;
}
interface CreateAssetDto {
    name: string;
    type: string;
    currentValue: string;
    currency?: string;
    notes?: string;
}
interface UpdateAssetDto {
    name?: string;
    type?: string;
    currentValue?: string;
    currency?: string;
    notes?: string;
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

type LiabilityType = "kartu_kredit" | "pinjaman_pribadi" | "kpr" | "kendaraan" | "lainnya";
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
    paymentRatio: number;
    notes: string | null;
    currency: string;
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
    notes?: string;
    currency?: string;
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
    notes?: string;
    currency?: string;
}

type InsuranceType = "jiwa" | "kesehatan" | "kendaraan" | "properti" | "lainnya";
type InsuranceStatus = "aktif" | "tidak_aktif" | "kadaluarsa";
type PremiumPeriod = "monthly" | "quarterly" | "yearly";
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
    policyNumber: string | null;
    daysUntilRenewal: number | null;
    notes: string | null;
    currency: string;
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
    policyNumber?: string;
    notes?: string;
    currency?: string;
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
    policyNumber?: string;
    notes?: string;
    currency?: string;
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
    accountName: string;
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

export { type AccountDto, AccountDtoSchema, type AccountSummaryItemDto, type AccountType, AccountTypeSchema, type AllocationItemDto, type AssetDto, type AssetHistoryDto, type AuthUser, AuthUserSchema, type BalanceSheetDto, type BankBreakdownItem, type BankReportDto, type BudgetDto, type BudgetPeriod, CONTRACTS_VERSION, type CashflowDto, type CashflowStatementDto, type CategoryBreakdownItem, type CategoryDto, CategoryDtoSchema, type CategoryKind, CategoryKindSchema, type CreateAccountInput, CreateAccountInputSchema, type CreateAssetDto, type CreateBudgetDto, type CreateGoalDto, type CreateInsuranceDto, type CreateLiabilityDto, type CreateTransactionInput, CreateTransactionInputSchema, type DashboardSummaryDto, type DetailReportDto, type DetailTransactionItem, type GoalDto, type GoalStatus, type InsuranceDto, type InsuranceStatus, type InsuranceSummaryDto, type InsuranceType, type InvestmentDto, type InvestmentSummaryDto, type InvestmentType, type LiabilityDto, type LiabilitySummaryDto, type LiabilityType, type LoginInput, LoginInputSchema, type NetWorthDto, type NotificationDto, type PeriodPoint, type PnlDto, type PremiumPeriod, type ReportPeriod, type ReportSummaryDto, type Rupiah, RupiahSchema, type SankeyDto, type SankeyLink, type SankeyNode, type SearchResponseDto, type SearchResultDto, type SearchResultType, type TransactionDto, TransactionDtoSchema, type TransactionListResponse, TransactionListResponseSchema, type TransactionSummary, TransactionSummarySchema, type TransactionType, TransactionTypeSchema, type UpdateAccountInput, UpdateAccountInputSchema, type UpdateAssetDto, type UpdateBudgetDto, type UpdateGoalDto, type UpdateInsuranceDto, type UpdateLiabilityDto };
