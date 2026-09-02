"use client";

// EPIC-022 Group F (F3) — CASL (apps/api/src/casl/casl-ability.factory.ts)
// already enforces who may create/update/delete Account, CoaAccount,
// Category, Budget, Goal and Investment rows; the UI offered the same
// create/edit/delete affordances to every role regardless, so a role CASL
// rejects only found out via a 403 after filling in a form. This mirrors
// ONLY the `can("manage", Subject)` grants for those six subjects — the
// same shape `useMyRole` already established for "owner/co-master only"
// gating (see its own header comment) — so a page can hide/disable an
// action the API would reject instead of inventing a new gating pattern.
import { useMyRole } from "./use-my-role";

type ManagedSubject =
  | "Account"
  | "CoaAccount"
  | "Category"
  | "ReferenceItem"
  | "Budget"
  | "Goal"
  | "Investment";

// Roles that hold `can("manage", Subject)` in the CASL factory, per subject.
// Every role NOT listed only has "read" (or no grant at all) for that
// subject and must not be offered create/edit/delete for it.
const MANAGE_ROLES: Record<ManagedSubject, ReadonlySet<string>> = {
  Account: new Set(["owner", "spouse"]),
  CoaAccount: new Set(["owner", "spouse"]),
  Category: new Set(["owner", "spouse"]),
  ReferenceItem: new Set(["owner", "spouse"]),
  Budget: new Set(["owner", "spouse", "member"]),
  Goal: new Set(["owner", "spouse", "member"]),
  Investment: new Set(["owner", "spouse", "member"]),
};

export function useCanManage(subject: ManagedSubject): {
  /** `undefined` while the role is still resolving — treat as "not yet known". */
  canManage: boolean | undefined;
  myRole: string | null | undefined;
  isLoading: boolean;
} {
  const { myRole, isLoading } = useMyRole();
  const canManage =
    myRole === undefined ? undefined : MANAGE_ROLES[subject].has(myRole ?? "");
  return { canManage, myRole, isLoading };
}
