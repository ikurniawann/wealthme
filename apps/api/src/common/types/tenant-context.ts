import type { Role } from "@prisma/client";

export interface TenantContext {
  userId: string;
  familyGroupId: string | null;
  role: Role | null;
  member: {
    id: string;
    userId: string;
    familyGroupId: string;
    role: Role;
  } | null;
}

declare module "express" {
  interface Request {
    tenantContext?: TenantContext;
  }
}
