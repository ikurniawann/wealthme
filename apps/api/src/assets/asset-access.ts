import { canSeePrivateItems, isRowScoped } from "../common/utils/privacy.util";

import type { TenantContext } from "../common/types/tenant-context";
import type { ScopeSubject } from "../common/utils/privacy.util";
import type { Prisma } from "@prisma/client";

/**
 * Aset A3/A5 — the only physical-asset rows any aggregate may sum
 * (dashboard, reports, ai-advisor, the net-worth snapshot writer and the
 * Aset overview). Linked assets (`investmentId`) are valued once, through
 * the Investasi valuation of their holding; sold/archived assets keep their
 * history but no longer count as wealth.
 */
export const COUNTED_ASSET_WHERE = {
  status: "active",
  investmentId: null,
} as const satisfies Prisma.AssetWhereInput;

/**
 * Aset A7 — row scope like accounts: a row-scoped member (dependant,
 * operational, or a Master-defined role with own-rows scope) sees only the
 * assets they own; every other role sees the family's assets. A missing
 * userId on a row-scoped role matches nothing, never "all".
 */
export function assetAccessWhere(
  member: ScopeSubject,
  userId: string | null | undefined,
): Prisma.AssetWhereInput {
  // "Shared with others" OFF hides the asset from everyone but Master,
  // Co-Master and admin_staff — the owner still sees their own row.
  const privacy: Prisma.AssetWhereInput =
    !member || canSeePrivateItems(member)
      ? {}
      : { OR: [{ isPrivate: false }, { ownerUserId: userId ?? "" }] };
  if (!isRowScoped(member)) return privacy;
  return { ownerUserId: userId ?? "" };
}

/** Who is asking (A7). Absent → an internal caller, family-wide. */
export interface AssetViewer {
  member: TenantContext["member"];
  userId: string | null;
}

export function viewerAssetWhere(
  viewer: AssetViewer | undefined,
): Prisma.AssetWhereInput {
  return viewer ? assetAccessWhere(viewer.member, viewer.userId) : {};
}
