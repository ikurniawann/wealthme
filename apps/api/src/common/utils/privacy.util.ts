import { ForbiddenException } from "@nestjs/common";
import { Role } from "@prisma/client";

import { AccountOwnerFilter } from "../../accounts/dto/list-accounts-query.dto";

import type { Prisma } from "@prisma/client";

/**
 * Whether a member with this role sees private accounts/categories (and their
 * transactions) in shared family views (dashboard + reports). `owner` set the
 * privacy flag; `admin_staff` is the trusted bookkeeper and always sees
 * everything. `spouse` (EPIC-023 Task C retry, D2) is a full financial
 * co-owner with "manage" over every money surface — a private flag cannot
 * silently hide data from a role that already has unrestricted CRUD on it. A
 * plain `member` (and the row-scoped `dependant`/`operational`, handled
 * separately below) are the roles privacy shields against.
 */
export function canSeePrivateItems(role: Role | null | undefined): boolean {
  return (
    role === Role.owner || role === Role.admin_staff || role === Role.spouse
  );
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

// ── EPIC-023 Task C — row-level scoping for `dependant`/`operational` ──────────
//
// CASL (casl-ability.factory.ts) grants `dependant` and `operational`
// "read"/"create" on Account/Transaction at the SUBJECT level — that check
// alone is not sufficient (D3/D5): both roles must additionally be
// restricted to rows they own or personally recorded, never the rest of the
// household ledger. The helpers below express that restriction as `where`
// fragments so every read path applies the identical rule; every other role
// (owner, spouse, member, admin_staff) is unrestricted here.

/** Whether this role is row-scoped ("dependant"/"operational" — D3/D5). */
export function isRowScopedRole(role: Role | null | undefined): boolean {
  return role === Role.dependant || role === Role.operational;
}

/**
 * `where` fragment restricting Account rows to the ones this user owns, or a
 * no-op for a role that is not row-scoped. `userId` missing on a row-scoped
 * role matches nothing rather than silently falling back to "all" (mirrors
 * `accountOwnerWhere`'s own guard).
 */
export function restrictedAccountWhere(
  role: Role | null | undefined,
  userId: string | undefined,
): Prisma.AccountWhereInput {
  if (!isRowScopedRole(role)) return {};
  return { ownerUserId: userId ?? "" };
}

/**
 * `where` fragment restricting Transaction rows to ones tied to an account
 * this user owns OR personally recorded (`createdByUserId`) OR that credit
 * an account this user owns (`toAccountId`) — the incoming leg of a
 * transfer, or a no-op for a role that is not row-scoped.
 *
 * The `toAccountId` leg (EPIC-023 Task C retry, MEDIUM finding) matters
 * because a transfer can be recorded entirely by someone else: when an
 * owner approves a dependant's allowance request,
 * `AllowanceRequestsService.approve()` creates the transfer with
 * `accountId` = the owner's account, `toAccountId` = the dependant's
 * account, and no `actingMember` (so `createdByUserId` is null). Without
 * this leg the dependant's balance changes but the transaction that moved
 * it is invisible to them — fail-closed, but it breaks the "sees their own
 * data" promise for the one transaction they most need to see.
 *
 * CALLERS MUST combine this with any other Transaction `where` fragment
 * (e.g. `transactionPrivacyWhere`) via a shared `AND` array, never by
 * object-spreading them together: both fragments may contribute a top-level
 * `OR`, and a naive spread lets the second one silently clobber the first
 * (see transactions.service.ts#buildWhere for the established pattern).
 */
export function restrictedTransactionWhere(
  role: Role | null | undefined,
  userId: string | undefined,
): Prisma.TransactionWhereInput {
  if (!isRowScopedRole(role)) return {};
  return {
    OR: [
      { account: { ownerUserId: userId ?? "" } },
      { createdByUserId: userId ?? "" },
      { toAccount: { ownerUserId: userId ?? "" } },
    ],
  };
}

/**
 * Denies `dependant`/`operational` outright. Used to gate household-wide
 * aggregates (multi-account reports, exports, net-worth history) that
 * cannot be meaningfully narrowed to "rows this user owns or recorded"
 * without producing a misleading result (a partial P&L or balance sheet is
 * not a privacy-preserving one, it is a wrong one). Prefer row-scoping
 * (above) wherever a read path CAN be restricted to "my own"; this is the
 * fallback for the paths that fundamentally cannot.
 */
export function assertHouseholdWideReadAllowed(
  role: Role | null | undefined,
): void {
  if (isRowScopedRole(role)) {
    throw new ForbiddenException(
      "This role does not have access to household-wide reports",
    );
  }
}
