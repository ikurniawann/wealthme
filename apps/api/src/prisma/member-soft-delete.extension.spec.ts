import { readFileSync } from "node:fs";
import { join } from "node:path";

import { withoutRemovedMembers } from "./member-soft-delete.extension";

/**
 * EPIC-027 A7 (D4) — the whole soft-delete decision rests on this extension
 * being applied to every Member read. If it silently stops filtering, a
 * removed member becomes visible (and, via the membership lookups that gate
 * access, active again) with no other test in the suite noticing. So exercise
 * the query hook directly rather than trusting the wiring.
 */
function run(operation: string, args: unknown): unknown {
  return withoutRemovedMembers(operation, args);
}

describe("memberSoftDeleteExtension", () => {
  it.each([
    "findFirst",
    "findFirstOrThrow",
    "findMany",
    "findUnique",
    "findUniqueOrThrow",
    "count",
    "aggregate",
    "groupBy",
  ])("injects deletedAt: null into %s", (operation) => {
    expect(run(operation, { where: { familyGroupId: "fg-1" } })).toEqual({
      where: { familyGroupId: "fg-1", deletedAt: null },
    });
  });

  it("adds a where clause when the caller passed none", () => {
    expect(run("findMany", {})).toEqual({ where: { deletedAt: null } });
  });

  it("tolerates a completely absent args object", () => {
    expect(run("findMany", undefined)).toEqual({ where: { deletedAt: null } });
  });

  it("leaves an explicit deletedAt filter alone — that is the opt-out", () => {
    const args = { where: { familyGroupId: "fg-1", deletedAt: { not: null } } };
    expect(run("findFirst", args)).toBe(args);
  });

  it.each(["create", "update", "updateMany", "delete", "deleteMany", "upsert"])(
    "does not filter %s — restoring a removed row is a write",
    (operation) => {
      const args = { where: { id: "m-1" }, data: { deletedAt: null } };
      expect(run(operation, args)).toBe(args);
    },
  );

  it("preserves other query arguments", () => {
    expect(
      run("findMany", {
        where: { familyGroupId: "fg-1" },
        include: { user: true },
        orderBy: { createdAt: "asc" },
      }),
    ).toEqual({
      where: { familyGroupId: "fg-1", deletedAt: null },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });
  });
});

/**
 * EPIC-027 A7 (security gate, CRITICAL) — the extension does NOT cover a
 * membership pulled through a nested `include`/`select` on another model:
 * Prisma resolves those inside the parent model's request, so the `member`
 * query hook never sees them. Three call sites therefore filter by hand, and
 * this test fails if any of them loses its filter. Reading the source is the
 * only way to assert this without a live database — and a silent regression
 * here re-opens the exact hole the epic exists to close.
 */
describe("nested membership reads filter removed members explicitly", () => {
  const read = (relative: string): string =>
    readFileSync(join(__dirname, "..", relative), "utf8");

  it("auth.service.ts filters both membership selects", () => {
    const src = read("auth/auth.service.ts");
    const selects = src.match(/memberships: \{/g) ?? [];
    const filtered =
      src.match(/memberships: \{\s*\n\s*where: \{ deletedAt: null \}/g) ?? [];
    expect(selects.length).toBeGreaterThan(0);
    expect(filtered).toHaveLength(selects.length);
  });

  it("family-groups.service.ts filters every nested member _count", () => {
    const src = read("family-groups/family-groups.service.ts");
    expect(src).not.toMatch(/_count: \{ select: \{ members: true \} \}/);
    expect(
      src.match(
        /_count: \{ select: \{ members: \{ where: \{ deletedAt: null \} \} \} \}/g,
      ),
    ).toHaveLength(2);
  });
});
