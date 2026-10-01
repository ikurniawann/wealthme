import { ForbiddenException } from "@nestjs/common";

import type { TenantContext } from "../types/tenant-context";
import type {
  AccountDto,
  DashboardSummaryDto,
  NetWorthDto,
  ReportPeriod,
  ReportSummaryDto,
} from "@wealthme/contracts";

/**
 * Per-member "Lihat saldo" (Member.canViewBalances). A member with it off
 * can still record transactions on accounts she may use, but every balance,
 * net worth and money aggregate is withheld SERVER SIDE: amounts become null
 * with an explicit `balancesHidden: true` marker, or the endpoint 403s when
 * the whole payload is money (reports, investments, net-worth history).
 * Owner/spouse never have it set (resolved in TenantGuard).
 */
type ViewerMember =
  | Pick<NonNullable<TenantContext["member"]>, "balancesHidden">
  | null
  | undefined;

export function areBalancesHidden(member: ViewerMember): boolean {
  return member?.balancesHidden === true;
}

export function assertBalancesVisible(member: ViewerMember): void {
  if (areBalancesHidden(member)) {
    throw new ForbiddenException({
      message: "Anggota ini tidak diizinkan melihat saldo",
      code: "BALANCES_HIDDEN",
    });
  }
}

export function redactAccount<T extends Pick<AccountDto, "balance">>(
  account: T,
  member: ViewerMember,
): T & { balancesHidden?: boolean } {
  if (!areBalancesHidden(member)) return account;
  return { ...account, balance: null, balancesHidden: true };
}

export function redactNetWorth(
  dto: NetWorthDto,
  member: ViewerMember,
): NetWorthDto {
  if (!areBalancesHidden(member)) return dto;
  return {
    currency: dto.currency,
    accountsTotal: null,
    investmentsTotal: null,
    assetsTotal: null,
    liabilitiesTotal: null,
    netWorth: null,
    balancesHidden: true,
  };
}

export function redactDashboardSummary(
  dto: DashboardSummaryDto,
  member: ViewerMember,
): DashboardSummaryDto {
  if (!areBalancesHidden(member)) return dto;
  return {
    ...dto,
    balancesHidden: true,
    netWorth: null,
    assetsTotal: null,
    cashflow: null,
    sparkline: [],
    allocation: [],
    accountSummary: [],
    currentMonth: null,
  };
}

const REPORT_PERIODS: readonly ReportPeriod[] = ["daily", "monthly", "yearly"];

/** /reports/summary (ringkasan) for a member whose "Lihat saldo" is off. */
export function hiddenReportSummary(period?: string): ReportSummaryDto {
  return {
    balancesHidden: true,
    period: REPORT_PERIODS.find((p) => p === period) ?? "monthly",
    points: [],
    totalIncome: null,
    totalExpense: null,
    netSavings: null,
    savingsRate: null,
    topIncomeCategories: [],
    topExpenseCategories: [],
  };
}
