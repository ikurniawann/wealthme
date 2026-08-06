-- EPIC-023 group E retry round 3 (MEDIUM 12)
-- Adds a per-Budget-row `budget_type` so an obligation's auto-created FIXED
-- budget line no longer has to mutate the (possibly shared) CoaAccount it
-- reads its category from. Nullable, additive — every existing row keeps
-- deriving its budgetType from `category.coa_account.budget_type` via
-- BudgetsService.toDto's fallback until it is next synced.
ALTER TABLE "budgets" ADD COLUMN "budgetType" "CoaBudgetType";
