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
}, "strip", z.ZodTypeAny, {
    type: "bank" | "ewallet" | "cash" | "investment" | "property";
    name: string;
    balance: number;
    currency: string;
    institution?: string | undefined;
    maskedNumber?: string | undefined;
    isPrivate?: boolean | undefined;
}, {
    type: "bank" | "ewallet" | "cash" | "investment" | "property";
    name: string;
    balance: number;
    institution?: string | undefined;
    maskedNumber?: string | undefined;
    currency?: string | undefined;
    isPrivate?: boolean | undefined;
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
}, "strip", z.ZodTypeAny, {
    type?: "bank" | "ewallet" | "cash" | "investment" | "property" | undefined;
    name?: string | undefined;
    institution?: string | undefined;
    maskedNumber?: string | undefined;
    balance?: number | undefined;
    currency?: string | undefined;
    isPrivate?: boolean | undefined;
}, {
    type?: "bank" | "ewallet" | "cash" | "investment" | "property" | undefined;
    name?: string | undefined;
    institution?: string | undefined;
    maskedNumber?: string | undefined;
    balance?: number | undefined;
    currency?: string | undefined;
    isPrivate?: boolean | undefined;
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
    isPrivate: z.ZodBoolean;
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
    isPrivate: boolean;
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
    accountId: string;
    amount: number;
    occurredAt: string;
    categoryId?: string | undefined;
    description?: string | undefined;
    toAccountId?: string | undefined;
    adminFee?: number | undefined;
}, {
    type: "income" | "expense" | "transfer";
    accountId: string;
    amount: number;
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
    accountId: z.ZodString;
    toAccountId: z.ZodNullable<z.ZodString>;
    categoryId: z.ZodNullable<z.ZodString>;
    amount: z.ZodString;
    type: z.ZodEnum<["income", "expense", "transfer"]>;
    description: z.ZodNullable<z.ZodString>;
    categoryName: z.ZodNullable<z.ZodString>;
    accountName: z.ZodString;
    toAccountName: z.ZodNullable<z.ZodString>;
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
    toAccountId: string | null;
    categoryName: string | null;
    accountName: string;
    toAccountName: string | null;
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
    toAccountId: string | null;
    categoryName: string | null;
    accountName: string;
    toAccountName: string | null;
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
        toAccountId: z.ZodNullable<z.ZodString>;
        categoryId: z.ZodNullable<z.ZodString>;
        amount: z.ZodString;
        type: z.ZodEnum<["income", "expense", "transfer"]>;
        description: z.ZodNullable<z.ZodString>;
        categoryName: z.ZodNullable<z.ZodString>;
        accountName: z.ZodString;
        toAccountName: z.ZodNullable<z.ZodString>;
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
        toAccountId: string | null;
        categoryName: string | null;
        accountName: string;
        toAccountName: string | null;
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
        toAccountId: string | null;
        categoryName: string | null;
        accountName: string;
        toAccountName: string | null;
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
        toAccountId: string | null;
        categoryName: string | null;
        accountName: string;
        toAccountName: string | null;
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
        toAccountId: string | null;
        categoryName: string | null;
        accountName: string;
        toAccountName: string | null;
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
        accountName: string;
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
    valueChangeRatePct: string | null;
    categoryId: string | null;
    currentEstimatedValue: string;
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
    valueChangeRatePct?: string;
    categoryId?: string;
}
interface UpdateAssetDto {
    name?: string;
    type?: string;
    currentValue?: string;
    currency?: string;
    notes?: string;
    valueChangeRatePct?: string;
    categoryId?: string;
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
    latestPriceRecordedAt: string | null;
    latestPriceSource: string | null;
    interestRatePct: string | null;
    projectedAnnualYield: string | null;
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
    autoAdvanceDueDate: boolean;
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
    autoAdvanceDueDate?: boolean;
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
    autoAdvanceDueDate?: boolean;
    notes?: string;
    currency?: string;
}

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
type ParticipantStatus = "pending" | "paid";
interface SplitParticipantDto {
    id: string;
    splitBillId: string;
    name: string;
    amountOwed: string;
    status: ParticipantStatus;
    paidAt: string | null;
    createdAt: string;
}
interface SplitBillDto {
    id: string;
    familyGroupId: string;
    title: string;
    totalAmount: string;
    currency: string;
    shareToken: string;
    status: SplitStatus;
    notes: string | null;
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
    participants: CreateSplitParticipantDto[];
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
    /** Total liabilities/debts (IDR) */
    liabilities: number;
}
interface ZakatResultDto {
    /** Total zakatable wealth = cash + investments + gold − liabilities */
    zakatable: number;
    /** Nisab threshold (85g gold × Rp 1,100,000) */
    nisab: number;
    /** Zakat amount due (2.5% of zakatable if obligated) */
    zakat: number;
    /** Whether zakat is obligated (zakatable >= nisab) */
    isObligated: boolean;
}
interface Pph21RequestDto {
    /** Annual gross income (IDR) */
    grossIncome: number;
    /** Zakat paid in the year (reduces PKP) */
    zakatPaid?: number;
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

type DonationType = "zakat_maal" | "zakat_fitrah" | "infaq" | "sedekah" | "wakaf" | "lainnya";
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
}
interface CreateTaxRecordDto {
    taxYear: number;
    grossIncome: string;
    ptkp: string;
    netTax?: string;
    sptStatus?: SptStatus;
    documentUrl?: string;
    notes?: string;
}
interface UpdateTaxRecordDto {
    taxYear?: number;
    grossIncome?: string;
    ptkp?: string;
    netTax?: string;
    sptStatus?: SptStatus;
    documentUrl?: string;
    notes?: string;
}

export { type AccountDto, AccountDtoSchema, type AccountSummaryItemDto, type AccountType, AccountTypeSchema, type AllocationItemDto, type AssetDto, type AssetHistoryDto, type AuthUser, AuthUserSchema, type BalanceSheetDto, type BankBreakdownItem, type BankReportDto, type BudgetDto, type BudgetPeriod, type BudgetType, CONTRACTS_VERSION, type CashflowDto, type CashflowStatementDto, type CategoryBreakdownItem, type CategoryDto, CategoryDtoSchema, type CategoryKind, CategoryKindSchema, type CoaChartBudgetType, type CoaChartDirection, type CoaChartEntry, type CreateAccountInput, CreateAccountInputSchema, type CreateAssetDto, type CreateBudgetDto, type CreateDonationDto, type CreateGoalDto, type CreateHeirDto, type CreateInheritanceAssetDto, type CreateInsuranceBeneficiaryDto, type CreateInsuranceDto, type CreateLiabilityDto, type CreateSplitBillDto, type CreateSplitParticipantDto, type CreateTaxRecordDto, type CreateTransactionInput, CreateTransactionInputSchema, type DashboardSummaryDto, type DetailReportDto, type DetailTransactionItem, type DonationDto, type DonationType, type ExportFormat, type ExportJobRequestDto, type ExportJobStatus, type ExportJobStatusDto, type ExportReportType, GENERIC_COA_CHART, type GoalDto, type GoalStatus, type InheritanceAssetDto, type InheritanceHeirDto, type InheritanceVisibility, type InsuranceBeneficiaryDto, type InsuranceDto, type InsuranceStatus, type InsuranceSummaryDto, type InsuranceType, type InvestmentCalcRequestDto, type InvestmentCalcResultDto, type InvestmentDto, type InvestmentSummaryDto, type InvestmentType, type KprCalcRequestDto, type KprCalcResultDto, type LiabilityDto, type LiabilitySummaryDto, type LiabilityType, type LoginInput, LoginInputSchema, type NetWorthDto, type NetWorthHistoryDto, type NetWorthHistoryPointDto, type NotificationDto, type ParticipantStatus, type PeriodPoint, type PnlDto, type Pph21RequestDto, type Pph21ResultDto, type PremiumPeriod, type ReportPeriod, type ReportSummaryDto, type RetirementCalcRequestDto, type RetirementCalcResultDto, type Rupiah, RupiahSchema, type SankeyDto, type SankeyLink, type SankeyNode, type SearchResponseDto, type SearchResultDto, type SearchResultType, type SplitBillDto, type SplitParticipantDto, type SplitStatus, type SptStatus, type TaxBracketDto, type TaxRecordDto, type TransactionDto, TransactionDtoSchema, type TransactionListResponse, TransactionListResponseSchema, type TransactionSummary, TransactionSummarySchema, type TransactionType, TransactionTypeSchema, type UpdateAccountInput, UpdateAccountInputSchema, type UpdateAssetDto, type UpdateBudgetDto, type UpdateDonationDto, type UpdateGoalDto, type UpdateInheritanceAssetDto, type UpdateInsuranceDto, type UpdateLiabilityDto, type UpdateTaxRecordDto, type ZakatRequestDto, type ZakatResultDto, defaultCoaCodeForCategory };
