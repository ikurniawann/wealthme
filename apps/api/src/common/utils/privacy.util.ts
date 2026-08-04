import { Role } from "@prisma/client";

import { AccountOwnerFilter } from "../../accounts/dto/list-accounts-query.dto";

import type { Prisma } from "@prisma/client";

/**
 * Whether a member with this role sees private accounts/categories (and their
 * transactions) in shared family views (dashboard + reports). `owner` set the
 * privacy flag; `admin_staff` is the trusted bookkeeper and always sees
 * everything. A plain `member` is the only role privacy shields against.
 */
export function canSeePrivateItems(role: Role | null | undefined): boolean {
  return role === Role.owner || role === Role.admin_staff;
}

/** `where` fragment that hides private accounts, or a no-op when the viewer may see them. */
export function accountPrivacyWhere(
  canSeePrivate: boolean,
): Prisma.AccountWhereInput {
  return canSeePrivate ? {} : { isPrivate: false };
}

/** `where` fragment that hides private categories, or a no-op when the viewer may see them. */
export function categoryPrivacyWhere(
  canSeePrivate: boolean,
): Prisma.CategoryWhereInput {
  return canSeePrivate ? {} : { isPrivate: false };
}

/**
 * `where` fragment for the EPIC-019 Task A "mine vs family" accounts lens.
 * `me` with no `requestingUserId` (should not happen on an authenticated
 * route) matches nothing rather than silently falling back to "all".
 */
export function accountOwnerWhere(
  filter: AccountOwnerFilter | undefined,
  requestingUserId: string | undefined,
): Prisma.AccountWhereInput {
  if (filter === AccountOwnerFilter.me) {
    return { ownerUserId: requestingUserId ?? "" };
  }
  if (filter === AccountOwnerFilter.family) {
    return { ownerUserId: null };
  }
  return {};
}

/**
 * `where` fragment for a flat (non-nested) Transaction query: excludes
 * transactions tied to a private account or a private category. `categoryId`
 * is nullable — a null-category transaction is never excluded on that basis.
 * No-op when the viewer may see private items.
 */
export function transactionPrivacyWhere(
  canSeePrivate: boolean,
): Prisma.TransactionWhereInput {
  if (canSeePrivate) return {};
  return {
    account: { isPrivate: false },
    OR: [{ categoryId: null }, { category: { isPrivate: false } }],
  };
}

/**
 * `where` fragment for a Transaction query nested under an already
 * account-privacy-filtered Account (e.g. `account.findMany({ include: {
 * transactions: { where: ... } } })`). Only the category half is needed —
 * the parent account is already excluded upstream when private.
 */
export function nestedTransactionCategoryPrivacyWhere(
  canSeePrivate: boolean,
): Prisma.TransactionWhereInput {
  if (canSeePrivate) return {};
  return { OR: [{ categoryId: null }, { category: { isPrivate: false } }] };
}
