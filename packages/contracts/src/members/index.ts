import { z } from "zod";

// EPIC-023 Task C (D1) — two axes. `MemberRelationship` is purely
// descriptive kinship and carries NO permission on its own; `Role` (below)
// is the only axis that grants authority. Mirrors the Prisma
// `MemberRelationship`/`Role` enums (apps/api/prisma/schema.prisma) — kept
// here, not imported from `@prisma/client`, so the web app can share the
// same values without depending on the API's generated client.
export const MemberRelationshipSchema = z.enum([
  "istri",
  "anak",
  "kakek",
  "nenek",
  "bibi",
  "supir",
  "sekretaris",
  "bendahara",
]);
export type MemberRelationship = z.infer<typeof MemberRelationshipSchema>;

export const RoleSchema = z.enum([
  "owner",
  "member",
  "admin_staff",
  "spouse",
  "dependant",
  "operational",
]);
export type Role = z.infer<typeof RoleSchema>;

/**
 * Relationship -> default role. Pre-fills the role picker when a head adds a
 * member by kinship; the result stays fully editable — the API accepts any
 * (relationship, role) pair the head chooses. This mapping only supplies the
 * default, it is never enforced as a constraint (D1).
 */
export const DEFAULT_ROLE_BY_RELATIONSHIP: Record<MemberRelationship, Role> = {
  istri: "spouse",
  anak: "dependant",
  kakek: "member",
  nenek: "member",
  bibi: "member",
  supir: "operational",
  sekretaris: "operational",
  bendahara: "admin_staff",
};

export function defaultRoleForRelationship(
  relationship: MemberRelationship,
): Role {
  return DEFAULT_ROLE_BY_RELATIONSHIP[relationship];
}
