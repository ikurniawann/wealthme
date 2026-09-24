"use client";

import { canAccessPage, type AccessPage } from "@wealthme/contracts";

import { useMyAccess } from "./use-my-access";
import { useMyRole } from "./use-my-role";

type ManagedSubject =
  | "Account"
  | "Asset"
  | "CoaAccount"
  | "Category"
  | "ReferenceItem"
  | "Budget"
  | "Goal"
  | "Investment";

/**
 * EPIC-030 — "may this member edit X?" now comes from the Master's IAM grant
 * on the page that owns X (`manage`). For members the Master has not
 * customised, the legacy presets reproduce the old per-role table exactly.
 */
const SUBJECT_PAGES: Record<ManagedSubject, readonly AccessPage[]> = {
  Account: ["dana", "rekening"],
  Asset: ["aset"],
  CoaAccount: ["mastercoa"],
  Category: ["masterdata"],
  ReferenceItem: ["masterdata"],
  Budget: ["anggaran"],
  Goal: ["tujuan"],
  Investment: ["investasi"],
};

export function useCanManage(subject: ManagedSubject): {
  /** `undefined` while access is still resolving — treat as "not yet known". */
  canManage: boolean | undefined;
  myRole: string | null | undefined;
  isLoading: boolean;
} {
  const { myRole } = useMyRole();
  const { access, isLoading } = useMyAccess();
  const canManage =
    access === undefined
      ? undefined
      : access !== null &&
        SUBJECT_PAGES[subject].some((page) =>
          canAccessPage(access, page, "manage"),
        );
  return { canManage, myRole, isLoading };
}
