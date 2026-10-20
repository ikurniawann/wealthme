import { Role, type Prisma } from "@prisma/client";

import { isRowScoped } from "../common/utils/privacy.util";

import type { TenantContext } from "../common/types/tenant-context";

/**
 * Asuransi S9 — who is asking. Built from `req.tenantContext` by the
 * controller; services never trust a client-sent user id.
 */
export interface InsuranceViewer {
  userId: string | null;
  role: Role | null;
  rowScoped: boolean;
}

export function viewerFromTenant(
  ctx: TenantContext | undefined,
): InsuranceViewer {
  const member = ctx?.member ?? null;
  return {
    userId: ctx?.userId ?? null,
    role: member?.role ?? null,
    rowScoped: member ? isRowScoped(member) : true,
  };
}

/** Master (owner) and Co-Master (spouse) see every policy of the family. */
export function seesAllInsurances(viewer: InsuranceViewer): boolean {
  return viewer.role === Role.owner || viewer.role === Role.spouse;
}

/**
 * S9 row scoping, modelled on accounts: a policy is visible to its holder,
 * payer, an insured family member, an explicit share, and whoever recorded
 * it. A policy with NO person attached (no holder/payer user, no insured
 * member, no share — every legacy row) is family-wide, like an account with
 * no owner: visible to every non-row-scoped member, never to a row-scoped
 * one. Master/Co-Master see all.
 */
export function insuranceVisibilityWhere(
  viewer: InsuranceViewer,
): Prisma.InsuranceWhereInput {
  if (seesAllInsurances(viewer)) return {};
  const uid = viewer.userId ?? "";
  const linked: Prisma.InsuranceWhereInput[] = [
    { holderUserId: uid },
    { payerUserId: uid },
    { createdByUserId: uid },
    { insured: { some: { memberUserId: uid } } },
    { shares: { some: { userId: uid } } },
  ];
  if (!viewer.rowScoped) {
    linked.push({
      holderUserId: null,
      payerUserId: null,
      insured: { none: { memberUserId: { not: null } } },
      shares: { none: {} },
    });
  }
  return { OR: linked };
}
