import type { CoaBudgetType } from "@prisma/client";

/**
 * EPIC-023 group E retry round 4 (C2/C3) — `Budget.budgetType` (added by
 * the MEDIUM 12 migration) is authoritative when set; every row synced by
 * `LiabilitiesService.syncPrincipalBudgetLine` /
 * `InsurancesService.syncPremiumBudgetLine` always sets it. Pre-migration
 * rows (and any row never re-synced since) still carry `budgetType: null`,
 * so those fall back to the category's (possibly shared) CoaAccount
 * `budgetType` — the ONLY signal that existed before this column did.
 *
 * Shared by `BudgetsService.toDto` (what `/anggaran` displays) and
 * `LiabilitiesService`/`InsurancesService`'s `warnIfPriorSharedBudgetLine`
 * (which needs to answer the exact same "is this FIXED" question against a
 * budget line that may predate the migration) — both MUST agree, or a line
 * `/anggaran` shows as FIXED could still fail the double-count warning's
 * FIXED check, and vice versa.
 */
export function effectiveBudgetType(budget: {
  budgetType: CoaBudgetType | null;
  category: { coaAccount: { budgetType: CoaBudgetType | null } };
}): CoaBudgetType | null {
  return budget.budgetType ?? budget.category.coaAccount.budgetType;
}
