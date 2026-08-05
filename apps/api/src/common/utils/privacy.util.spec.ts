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
} from "./privacy.util";

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
