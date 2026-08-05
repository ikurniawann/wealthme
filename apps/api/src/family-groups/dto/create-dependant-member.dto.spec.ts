import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreateDependantMemberDto } from "./create-dependant-member.dto";

const VALID = {
  name: "Adit",
  username: "adit_kecil",
  initialPassword: "changeMe123",
  role: "dependant",
};

describe("CreateDependantMemberDto", () => {
  it("accepts a valid dependant payload", async () => {
    const dto = plainToInstance(CreateDependantMemberDto, VALID);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("accepts a valid operational payload with an optional relationship", async () => {
    const dto = plainToInstance(CreateDependantMemberDto, {
      ...VALID,
      role: "operational",
      relationship: "supir",
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  // Mirrors better-auth's OWN `username` plugin default validator exactly
  // (verified against node_modules/.../better-auth/dist/plugins/username/
  // index.mjs: `/^[a-zA-Z0-9_.]+$/`, minUsernameLength 3, maxUsernameLength
  // 30) — a username this DTO rejects would also be rejected by better-auth
  // itself, and vice versa.
  it.each(["ab", "a".repeat(31), "has space", "has/slash", "emoji😀"])(
    "rejects an invalid username %p",
    async (username) => {
      const dto = plainToInstance(CreateDependantMemberDto, {
        ...VALID,
        username,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === "username")).toBe(true);
    },
  );

  it("accepts the boundary lengths (3 and 30 chars)", async () => {
    for (const username of ["abc", "a".repeat(30)]) {
      const dto = plainToInstance(CreateDependantMemberDto, {
        ...VALID,
        username,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });

  it("rejects an initial password shorter than 8 characters", async () => {
    const dto = plainToInstance(CreateDependantMemberDto, {
      ...VALID,
      initialPassword: "short1",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "initialPassword")).toBe(true);
  });

  it("rejects a name shorter than 2 characters", async () => {
    const dto = plainToInstance(CreateDependantMemberDto, {
      ...VALID,
      name: "A",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "name")).toBe(true);
  });

  // `role` itself only gets shape validation here (any real `Role` enum
  // value passes) — the dependant/operational-only business rule is
  // enforced server-side with a code-carrying error, see
  // family-groups.service.spec.ts's "INVALID_ROLE_FOR_DEPENDANT_CREATION"
  // coverage.
  it("rejects a role that isn't a real Role enum value", async () => {
    const dto = plainToInstance(CreateDependantMemberDto, {
      ...VALID,
      role: "not-a-role",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "role")).toBe(true);
  });
});
