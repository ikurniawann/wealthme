import {
  INTERNAL_EMAIL_SUFFIX,
  displayEmail,
  isInternalEmail,
} from "./display-email";

describe("isInternalEmail", () => {
  it("flags the synthetic member mailbox", () => {
    expect(isInternalEmail(`member-abc${INTERNAL_EMAIL_SUFFIX}`)).toBe(true);
    expect(isInternalEmail("MEMBER-X@Members.Internal.WealthMe.Invalid")).toBe(
      true,
    );
  });

  it("does not flag real or empty emails", () => {
    expect(isInternalEmail("budi@gmail.com")).toBe(false);
    expect(isInternalEmail("x@members.internal.wealthme.id")).toBe(false);
    expect(isInternalEmail("")).toBe(false);
    expect(isInternalEmail(null)).toBe(false);
    expect(isInternalEmail(undefined)).toBe(false);
  });
});

describe("displayEmail", () => {
  it("returns real emails and null for placeholders/missing", () => {
    expect(displayEmail("budi@gmail.com")).toBe("budi@gmail.com");
    expect(displayEmail(`member-1${INTERNAL_EMAIL_SUFFIX}`)).toBeNull();
    expect(displayEmail(null)).toBeNull();
  });
});
