/**
 * EPIC-023 group E retry (HIGH 4) — deterministic, per-obligation category
 * name: `${label} — ${obligationName} (${idPrefix})`. Baking the
 * obligation's own id in eliminates the
 * `@@unique([familyGroupId, name, kind])` collision class between two
 * DIFFERENT obligations (even ones sharing a display name) by construction,
 * instead of relying on a retry to paper over it. Shared by
 * `LiabilitiesService.resolveOwnPrincipalCategoryId` and
 * `InsurancesService.resolveOwnPremiumCategoryId`.
 */
export function ownCategoryName(
  label: string,
  obligationName: string,
  obligationId: string,
): string {
  return `${label} — ${obligationName} (${obligationId.slice(0, 8)})`;
}
