/**
 * EPIC-023 Task H1 review (MEDIUM fix 2) — `packages/contracts`'
 * `AssetTypeId` union (and `DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT`, keyed by
 * it) hand-mirrors the Prisma `AssetType` enum with nothing tying them
 * together (contracts must stay framework-agnostic, so it cannot import
 * `@prisma/client` — this test lives in `apps/api` instead, where both are
 * available). This test asserts the two sets of values are identical so a
 * future 6th `AssetType` added to the Prisma enum fails CI instead of
 * silently drifting from contracts (and everything downstream that trusts
 * `AssetTypeId` — e.g. `apps/web`'s `AddAssetModal`). Mirrors the existing
 * `role-contract-drift.spec.ts` pattern (EPIC-023 Task C retry).
 */
import { AssetType } from "@prisma/client";
import { DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT } from "@wealthme/contracts";

function sorted(values: readonly string[]): string[] {
  return [...values].sort();
}

describe("AssetType contract drift", () => {
  it("DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT's keys (contracts' AssetTypeId) exactly match the Prisma AssetType enum's values", () => {
    expect(sorted(Object.keys(DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT))).toEqual(
      sorted(Object.values(AssetType)),
    );
  });
});
