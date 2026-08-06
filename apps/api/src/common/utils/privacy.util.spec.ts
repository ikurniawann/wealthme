/**
 * EPIC-023 Task C — row-level scoping helpers for `dependant`/`operational`.
 * CASL grants both roles "read"/"create" on Account/Transaction at the
 * subject level (see casl-ability.factory.spec.ts); these functions prove
 * the row-level half of that decision (D3/D5): every other role is a no-op,
 * a row-scoped role is always restricted to "mine".
 */
import { ForbiddenException } from "@nestjs/common";
import { Role } from "@prisma/client";

import {
  assertHouseholdWideReadAllowed,
  canSeePrivateItems,
  isRowScopedRole,
  restrictedAccountWhere,
  restrictedTransactionWhere,
  transactionPrivacyWhere,
} from "./privacy.util";

/**
 * General recursive evaluator for the small subset of Prisma `where` shapes
 * `transactionPrivacyWhere`/`restrictedTransactionWhere` can produce
 * (nested `AND`/`OR` combined with `accountId`/`account.isPrivate` and
 * `categoryId`/`category.isPrivate` leaf conditions). Deliberately generic
 * (not hardcoded to the NEW `AND`-of-`OR` shape) so this can evaluate the
 * OLD, buggy top-level `{ account: {...}, OR: [...] }` shape too — that is
 * what lets the CRITICAL regression test below assert on BEHAVIOR (does
 * this row match?) instead of only on object shape. The reviewer finding
 * was specifically that the existing specs mock `prisma.transaction.
 * findMany` directly and so cannot catch a `where`-construction bug at all.
 */
type Row = {
  accountId: string | null;
  account: { isPrivate: boolean } | null;
  categoryId: string | null;
  category: { isPrivate: boolean } | null;
};

function evalClause(clause: Record<string, unknown>, row: Row): boolean {
  const keys = Object.keys(clause);
  if (keys.length === 0) return true;
  return keys.every((key) => {
    const value = clause[key];
    if (key === "AND") {
      return (value as Record<string, unknown>[]).every((c) =>
        evalClause(c, row),
      );
    }
    if (key === "OR") {
      return (value as Record<string, unknown>[]).some((c) =>
        evalClause(c, row),
      );
    }
    if (key === "accountId") return row.accountId === null;
    if (key === "account") return row.account?.isPrivate === false;
    if (key === "categoryId") return row.categoryId === null;
    if (key === "category") return row.category?.isPrivate === false;
    throw new Error(`evalClause: unhandled key "${key}"`);
  });
}

function matchesRow(
  where: ReturnType<typeof transactionPrivacyWhere>,
  row: Row,
): boolean {
  return evalClause(where as Record<string, unknown>, row);
}

describe("canSeePrivateItems", () => {
  it("PERMISSION — owner, admin_staff, and spouse (D2 financial co-owner, EPIC-023 Task C retry) see private items", () => {
    expect(canSeePrivateItems(Role.owner)).toBe(true);
    expect(canSeePrivateItems(Role.admin_staff)).toBe(true);
    expect(canSeePrivateItems(Role.spouse)).toBe(true);
  });

  it("DENIAL — member, dependant, operational, null, and undefined do not see private items", () => {
    expect(canSeePrivateItems(Role.member)).toBe(false);
    expect(canSeePrivateItems(Role.dependant)).toBe(false);
    expect(canSeePrivateItems(Role.operational)).toBe(false);
    expect(canSeePrivateItems(null)).toBe(false);
    expect(canSeePrivateItems(undefined)).toBe(false);
  });
});

describe("isRowScopedRole", () => {
  it("is true for dependant and operational", () => {
    expect(isRowScopedRole(Role.dependant)).toBe(true);
    expect(isRowScopedRole(Role.operational)).toBe(true);
  });

  it("is false for owner, spouse, member, admin_staff, null, and undefined", () => {
    expect(isRowScopedRole(Role.owner)).toBe(false);
    expect(isRowScopedRole(Role.spouse)).toBe(false);
    expect(isRowScopedRole(Role.member)).toBe(false);
    expect(isRowScopedRole(Role.admin_staff)).toBe(false);
    expect(isRowScopedRole(null)).toBe(false);
    expect(isRowScopedRole(undefined)).toBe(false);
  });
});

describe("restrictedAccountWhere", () => {
  it("restricts a dependant to accounts they own", () => {
    expect(restrictedAccountWhere(Role.dependant, "user-child")).toEqual({
      ownerUserId: "user-child",
    });
  });

  it("restricts an operational member to accounts they own", () => {
    expect(restrictedAccountWhere(Role.operational, "user-driver")).toEqual({
      ownerUserId: "user-driver",
    });
  });

  it("is a no-op for owner/spouse/member/admin_staff", () => {
    expect(restrictedAccountWhere(Role.owner, "user-1")).toEqual({});
    expect(restrictedAccountWhere(Role.spouse, "user-1")).toEqual({});
    expect(restrictedAccountWhere(Role.member, "user-1")).toEqual({});
    expect(restrictedAccountWhere(Role.admin_staff, "user-1")).toEqual({});
  });

  it("matches nothing (never falls back to all) when a row-scoped role has no userId", () => {
    expect(restrictedAccountWhere(Role.dependant, undefined)).toEqual({
      ownerUserId: "",
    });
  });
});

describe("transactionPrivacyWhere", () => {
  it("is a no-op when the viewer may see private items", () => {
    expect(transactionPrivacyWhere(true)).toEqual({});
  });

  // CRITICAL regression (EPIC-023 group E retry, FIX 1) — a card purchase
  // (EPIC-023 E3) has accountId: null. Prisma's `{ account: { isPrivate:
  // false } }` on a nullable to-one relation REQUIRES the relation to
  // exist, so a naive AND of that condition with the categoryId OR would
  // silently exclude every card purchase for a restricted viewer. This
  // must be its own OR branch, exactly like the categoryId half.
  it("admits an accountId: null row (credit-card purchase) for a restricted viewer", () => {
    const where = transactionPrivacyWhere(false);
    expect(
      matchesRow(where, {
        accountId: null,
        account: null,
        categoryId: "cat-1",
        category: { isPrivate: false },
      }),
    ).toBe(true);
  });

  it("still excludes a transaction on a private account", () => {
    const where = transactionPrivacyWhere(false);
    expect(
      matchesRow(where, {
        accountId: "acc-1",
        account: { isPrivate: true },
        categoryId: null,
        category: null,
      }),
    ).toBe(false);
  });

  it("still excludes a transaction on a private category", () => {
    const where = transactionPrivacyWhere(false);
    expect(
      matchesRow(where, {
        accountId: "acc-1",
        account: { isPrivate: false },
        categoryId: "cat-1",
        category: { isPrivate: true },
      }),
    ).toBe(false);
  });

  it("admits a transaction on a public account with no category", () => {
    const where = transactionPrivacyWhere(false);
    expect(
      matchesRow(where, {
        accountId: "acc-1",
        account: { isPrivate: false },
        categoryId: null,
        category: null,
      }),
    ).toBe(true);
  });
});

describe("restrictedTransactionWhere", () => {
  it("restricts a dependant to transactions on an owned account OR personally recorded OR crediting an owned account (incoming transfer leg)", () => {
    expect(restrictedTransactionWhere(Role.dependant, "user-child")).toEqual({
      OR: [
        { account: { ownerUserId: "user-child" } },
        { createdByUserId: "user-child" },
        { toAccount: { ownerUserId: "user-child" } },
      ],
    });
  });

  // EPIC-023 Task C retry (MEDIUM finding) — when an owner approves a
  // dependant's allowance request, the transfer is created with
  // accountId = owner's account, toAccountId = the dependant's account, and
  // no actingMember (createdByUserId stays null). Without the `toAccount`
  // leg, this row would be invisible to the child even though it is the
  // transaction that changed their own balance — see
  // transactions.service.spec.ts's "allowance-approval scenario" describe
  // block for the end-to-end proof against the real service.
  it("contains a toAccount clause independent of the account/createdByUserId clauses (proves the incoming-transfer leg survives even when the other two clauses cannot match)", () => {
    const where = restrictedTransactionWhere(Role.dependant, "user-child");
    expect(where.OR).toContainEqual({
      toAccount: { ownerUserId: "user-child" },
    });
  });

  it("is a no-op for owner/spouse/member/admin_staff", () => {
    expect(restrictedTransactionWhere(Role.owner, "user-1")).toEqual({});
    expect(restrictedTransactionWhere(Role.spouse, "user-1")).toEqual({});
    expect(restrictedTransactionWhere(Role.member, "user-1")).toEqual({});
    expect(restrictedTransactionWhere(Role.admin_staff, "user-1")).toEqual({});
  });

  it("matches nothing (never falls back to all) when a row-scoped role has no userId", () => {
    expect(restrictedTransactionWhere(Role.operational, undefined)).toEqual({
      OR: [
        { account: { ownerUserId: "" } },
        { createdByUserId: "" },
        { toAccount: { ownerUserId: "" } },
      ],
    });
  });
});

describe("assertHouseholdWideReadAllowed", () => {
  it("DENIAL — throws ForbiddenException for dependant", () => {
    expect(() => assertHouseholdWideReadAllowed(Role.dependant)).toThrow(
      ForbiddenException,
    );
  });

  it("DENIAL — throws ForbiddenException for operational", () => {
    expect(() => assertHouseholdWideReadAllowed(Role.operational)).toThrow(
      ForbiddenException,
    );
  });

  it("does not throw for owner, spouse, member, admin_staff, or an internal caller (null)", () => {
    expect(() => assertHouseholdWideReadAllowed(Role.owner)).not.toThrow();
    expect(() => assertHouseholdWideReadAllowed(Role.spouse)).not.toThrow();
    expect(() => assertHouseholdWideReadAllowed(Role.member)).not.toThrow();
    expect(() =>
      assertHouseholdWideReadAllowed(Role.admin_staff),
    ).not.toThrow();
    expect(() => assertHouseholdWideReadAllowed(null)).not.toThrow();
  });
});
