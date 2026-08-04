/**
 * EPIC-023 Task C retry (MEDIUM six-reviewer finding) — `packages/contracts`
 * hand-mirrors the Prisma `Role`/`MemberRelationship` enums as zod schemas
 * with nothing tying them together (see
 * `packages/contracts/src/members/index.ts`). This test asserts the zod
 * schemas' options equal the Prisma enums' values for both, so a future
 * rename/addition on either side fails CI instead of drifting silently and
 * only surfacing at runtime (e.g. a role the API grants abilities for but
 * the web app cannot even render, or vice versa).
 */
import { MemberRelationship, Role } from "@prisma/client";
import { MemberRelationshipSchema, RoleSchema } from "@wealthme/contracts";

function sorted(values: readonly string[]): string[] {
  return [...values].sort();
}

describe("Role / MemberRelationship contract drift", () => {
  it("RoleSchema's options exactly match the Prisma Role enum's values", () => {
    expect(sorted(RoleSchema.options)).toEqual(sorted(Object.values(Role)));
  });

  it("MemberRelationshipSchema's options exactly match the Prisma MemberRelationship enum's values", () => {
    expect(sorted(MemberRelationshipSchema.options)).toEqual(
      sorted(Object.values(MemberRelationship)),
    );
  });
});
