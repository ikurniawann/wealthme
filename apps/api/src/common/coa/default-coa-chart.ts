/**
 * EPIC-017: the generic COA chart + category→COA mapping helper now live in the
 * shared `@wealthme/contracts` package so the web Better-Auth registration hook
 * can use the same source of truth. This module re-exports them to keep the
 * existing API-side imports (auth.service, seed) stable.
 *
 * The `*_add_category_coa_link` migration mirrors GENERIC_COA_CHART in raw SQL.
 */
export {
  GENERIC_COA_CHART,
  defaultCoaCodeForCategory,
  type CoaChartEntry,
} from "@wealthme/contracts";
