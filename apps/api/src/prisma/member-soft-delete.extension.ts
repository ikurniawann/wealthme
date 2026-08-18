import { Prisma } from "@prisma/client";

/**
 * EPIC-027 A7 (D4) — global read filter for soft-deleted members.
 *
 * `FamilyGroupsService#removeMember` used to hard-delete the `Member` row and
 * nothing else. The `User` row and its `baAccount` credential survived, so a
 * removed child still signed in by username; `getMe` then resolved
 * `familyGroupId: null`, and the web shell treats an unknown role as *trusted*
 * (`isNavItemVisibleForRole`), so the removed member saw a near-full menu.
 * Members are now soft-deleted instead, which only works if every read path
 * agrees to ignore removed rows.
 *
 * There are 23 `prisma.member.*` call sites across the API and 20 more places
 * that pull `memberships` through an include. Filtering each by hand would
 * work exactly until the next query someone writes without the filter — the
 * failure mode being a security hole, not a glitch. So the filter lives here,
 * applied once to the client, and a query has to *opt out* to see removed
 * members rather than opt in to hiding them.
 *
 * Opt-out contract: pass a DEFINED `deletedAt` and this extension leaves the
 * argument alone — `deletedAt: { not: null }` lists only removed members (the
 * "Anggota Nonaktif" panel).
 *
 * The check is `!== undefined`, not `"deletedAt" in where`: `in` is true for
 * `{ deletedAt: undefined }`, and Prisma drops undefined-valued keys, so that
 * spelling would opt out of the filter AND then apply no constraint at all —
 * every removed member visible. A generic `{ ...filters, deletedAt:
 * filters.deletedAt }` spread reaches that state without anyone intending it.
 *
 * `findUnique`/`findUniqueOrThrow` accept this extra non-unique condition
 * because `extendedWhereUnique` is GA in Prisma 5+ (this repo is on 6.19).
 *
 * Writes are deliberately NOT filtered. `update`/`delete` on a removed row is
 * how restoration works, and blocking it here would make the restore endpoint
 * impossible to write.
 */
const FILTERED_READ_OPERATIONS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
]);

type WhereArgs = { where?: Record<string, unknown> };

/**
 * The filter itself, exported so it can be unit-tested directly.
 * `Prisma.defineExtension` returns an opaque wrapper rather than the literal
 * passed to it, so a test cannot reach inside the extension to reach this.
 */
export function withoutRemovedMembers<A>(operation: string, args: A): A {
  if (!FILTERED_READ_OPERATIONS.has(operation)) return args;

  const typedArgs = (args ?? {}) as WhereArgs;
  const where = typedArgs.where ?? {};

  // Caller asked about removed members explicitly — respect it. An
  // `undefined` value is NOT an opt-out (see the contract above).
  if (where["deletedAt"] !== undefined) return args;

  return { ...typedArgs, where: { ...where, deletedAt: null } } as A;
}

export const memberSoftDeleteExtension = Prisma.defineExtension({
  name: "member-soft-delete",
  query: {
    member: {
      $allOperations({ operation, args, query }) {
        return query(withoutRemovedMembers(operation, args));
      },
    },
  },
});
