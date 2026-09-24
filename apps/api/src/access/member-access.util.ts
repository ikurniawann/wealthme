import {
  AccessPermissionsSchema,
  resolveEffectiveAccess,
  type AccessPermissions,
  type EffectiveAccess,
} from "@wealthme/contracts";

import type { AccessDataScope, Prisma, Role } from "@prisma/client";

/** Prisma `select` for everything access resolution needs on a Member. */
export const MEMBER_ACCESS_SELECT = {
  role: true,
  accessOverrides: true,
  accessRole: { select: { permissions: true, dataScope: true } },
} as const satisfies Prisma.MemberSelect;

type MemberAccessRow = {
  role: Role;
  accessOverrides: Prisma.JsonValue | null;
  accessRole: {
    permissions: Prisma.JsonValue;
    dataScope: AccessDataScope;
  } | null;
};

/**
 * JSON columns are re-validated on every read: a malformed or stale value
 * degrades to "no grants" rather than to anything wider.
 */
export function parsePermissions(
  raw: Prisma.JsonValue | null | undefined,
): AccessPermissions {
  const parsed = AccessPermissionsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : {};
}

export function effectiveAccessForMember(
  member: MemberAccessRow,
): EffectiveAccess {
  return resolveEffectiveAccess({
    role: member.role,
    accessRole: member.accessRole
      ? {
          permissions: parsePermissions(member.accessRole.permissions),
          dataScope: member.accessRole.dataScope,
        }
      : null,
    overrides: parsePermissions(member.accessOverrides),
  });
}
