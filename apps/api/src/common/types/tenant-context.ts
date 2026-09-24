import type { Role } from "@prisma/client";
import type { EffectiveAccess } from "@wealthme/contracts";

export interface TenantContext {
  userId: string;
  familyGroupId: string | null;
  role: Role | null;
  member: {
    id: string;
    userId: string;
    familyGroupId: string;
    role: Role;
    /** EPIC-030 — effective data scope (see privacy.util ScopeSubject). */
    rowScoped: boolean;
  } | null;
  /** EPIC-030 — effective page access; null outside a family route. */
  access: EffectiveAccess | null;
}

declare module "express" {
  interface Request {
    tenantContext?: TenantContext;
  }
}
