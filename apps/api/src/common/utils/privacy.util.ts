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
export function canSeePrivateItems(subject: ScopeSubject): boolean {
  const role = roleOf(subject);
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
 * transactions tied to a private account or a private category. Both
 * `accountId` (EPIC-023 E3 — a credit-card purchase has `accountId: null`)
 * and `categoryId` are nullable — a null relation is never excluded on that
 * basis, mirroring the nullable-`categoryId` half below. No-op when the
 * viewer may see private items.
 *
 * CRITICAL fix (EPIC-023 group E retry) — Prisma's `{ account: { isPrivate:
 * false } }` on a nullable to-one relation REQUIRES the relation to exist,
 * so it silently excluded every `accountId: null` row (every card purchase)
 * for a restricted viewer. That is why this must be an `OR` branch exactly
 * like the `categoryId` one, not a separate top-level AND-ed condition.
 */
export function transactionPrivacyWhere(
  canSeePrivate: boolean,
): Prisma.TransactionWhereInput {
  if (canSeePrivate) return {};
  return {
    AND: [
      { OR: [{ accountId: null }, { account: { isPrivate: false } }] },
      { OR: [{ categoryId: null }, { category: { isPrivate: false } }] },
    ],
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
 * EPIC-030 — who the privacy helpers are asked about. A bare `Role` keeps the
 * pre-IAM rule (dependant/operational are row-scoped). A `{ role, rowScoped }`
 * object — what TenantGuard stamps on `tenantContext.member` — carries the
 * member's EFFECTIVE data scope, so a Master-defined role can widen a child
 * to the whole family's data or narrow an adult to their own rows.
 */
export type ScopeSubject =
  | Role
  | null
  | undefined
  | {
      role: Role;
      rowScoped?: boolean;
      /**
       * Row-scoped member who may still see the family-shared (ownerUserId
       * null), non-private accounts and their history — granted by the Bank &
       * Account / Cash & E-Wallet page. Absent → own rows only.
       */
      seesSharedAccounts?: boolean;
    };

function seesShared(subject: ScopeSubject): boolean {
  return (
    subject !== null &&
    typeof subject === "object" &&
    subject.seesSharedAccounts === true
  );
}

/** A family-shared account a restricted member may read (never a private one). */
const SHARED_VISIBLE_ACCOUNT = { ownerUserId: null, isPrivate: false } as const;

function roleOf(subject: ScopeSubject): Role | null | undefined {
  return subject !== null && typeof subject === "object"
    ? subject.role
    : subject;
}

/**
 * Effective row-scoping for a subject (see ScopeSubject). An object without
 * `rowScoped` falls back to the role rule — never to "unrestricted".
 */
export function isRowScoped(subject: ScopeSubject): boolean {
  if (subject !== null && typeof subject === "object") {
    return typeof subject.rowScoped === "boolean"
      ? subject.rowScoped
      : isRowScopedRole(subject.role);
  }
  return isRowScopedRole(subject);
}

/**
 * `where` fragment restricting Account rows to the ones this user owns, or a
 * no-op for a role that is not row-scoped. `userId` missing on a row-scoped
 * role matches nothing rather than silently falling back to "all" (mirrors
 * `accountOwnerWhere`'s own guard).
 */
export function restrictedAccountWhere(
  subject: ScopeSubject,
  userId: string | undefined,
): Prisma.AccountWhereInput {
  if (!isRowScoped(subject)) return {};
  const own = { ownerUserId: userId ?? "" };
  // Rekening v3 — an account explicitly shared with this member
  // ("Dibagikan kepada") is theirs to see too.
  const sharedWithMe = { shares: { some: { userId: userId ?? "" } } };
  return {
    OR: seesShared(subject)
      ? [own, sharedWithMe, SHARED_VISIBLE_ACCOUNT]
      : [own, sharedWithMe],
  };
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
  subject: ScopeSubject,
  userId: string | undefined,
): Prisma.TransactionWhereInput {
  if (!isRowScoped(subject)) return {};
  return {
    OR: [
      { account: { ownerUserId: userId ?? "" } },
      { createdByUserId: userId ?? "" },
      { toAccount: { ownerUserId: userId ?? "" } },
      // Rekening v3 — history of an account explicitly shared with them.
      { account: { shares: { some: { userId: userId ?? "" } } } },
      { toAccount: { shares: { some: { userId: userId ?? "" } } } },
      // Read-only history of family-shared accounts (writes stay own-only:
      // TransactionsService.assertAccountOwnedByActingMember).
      ...(seesShared(subject) ? [{ account: SHARED_VISIBLE_ACCOUNT }] : []),
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
export function assertHouseholdWideReadAllowed(subject: ScopeSubject): void {
  if (isRowScoped(subject)) {
    throw new ForbiddenException(
      "This role does not have access to household-wide reports",
    );
  }
}
