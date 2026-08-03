import { BadRequestException, ConflictException } from "@nestjs/common";

import { assertValidCoaCode, nextFreeCoaCode } from "./coa-code.util";

describe("nextFreeCoaCode", () => {
  it("returns the first code in the group's range when none exist yet", () => {
    expect(nextFreeCoaCode(2, [])).toBe("20001");
  });

  it("skips codes already used by another group and picks the next free one in-group", () => {
    // Group 2 already has 20001..20003 (plus an unrelated group-1 code and a
    // sparse group-2 "catch-all" at 20099) — next free must be 20004, not
    // jump straight to 20100 or collide with group 1's codes.
    const existing = ["10001", "20001", "20002", "20003", "20099"];
    expect(nextFreeCoaCode(2, existing)).toBe("20004");
  });

  it("fills a gap left by a deleted code instead of only growing the running max", () => {
    const existing = ["20001", "20003"]; // 20002 was deleted
    expect(nextFreeCoaCode(2, existing)).toBe("20002");
  });

  it("throws ConflictException when the group's code range is exhausted", () => {
    const all9999 = Array.from(
      { length: 9999 },
      (_, i) => `2${String(i + 1).padStart(4, "0")}`,
    );
    expect(() => nextFreeCoaCode(2, all9999)).toThrow(ConflictException);
  });
});

describe("assertValidCoaCode", () => {
  it("accepts a code whose first digit matches groupNum", () => {
    expect(() => assertValidCoaCode("20101", 2)).not.toThrow();
  });

  it("rejects a code whose first digit does not match groupNum", () => {
    expect(() => assertValidCoaCode("10101", 2)).toThrow(BadRequestException);
  });

  it("rejects a code that is not exactly 5 digits", () => {
    expect(() => assertValidCoaCode("201", 2)).toThrow(BadRequestException);
    expect(() => assertValidCoaCode("2010199", 2)).toThrow(BadRequestException);
  });

  it("rejects a non-numeric code", () => {
    expect(() => assertValidCoaCode("2ABCD", 2)).toThrow(BadRequestException);
  });
});
