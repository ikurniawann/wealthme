import { mapServerFieldErrors, validateMemberForm } from "./member-form-errors";

const ok = {
  name: "Supri",
  username: "supri",
  password: "12345678",
  email: "",
};

describe("validateMemberForm", () => {
  it("accepts a valid form", () => {
    expect(validateMemberForm(ok)).toEqual({});
  });
  it("flags a 6-char password as too short", () => {
    expect(validateMemberForm({ ...ok, password: "123456" })).toEqual({
      password: "passwordTooShort",
    });
  });
  it("flags empty required fields", () => {
    expect(
      validateMemberForm({ name: "", username: "", password: "", email: "" }),
    ).toEqual({
      name: "nameRequired",
      username: "usernameRequired",
      password: "passwordRequired",
    });
  });
  it("rejects usernames the API would reject", () => {
    expect(validateMemberForm({ ...ok, username: "ab" }).username).toBe(
      "usernameInvalid",
    );
    expect(validateMemberForm({ ...ok, username: "a b c" }).username).toBe(
      "usernameInvalid",
    );
  });
  it("validates a non-empty email only", () => {
    expect(validateMemberForm({ ...ok, email: "nope" }).email).toBe(
      "emailInvalid",
    );
    expect(validateMemberForm({ ...ok, email: "a@b.co" })).toEqual({});
  });
});

describe("mapServerFieldErrors", () => {
  it("maps USERNAME_TAKEN to the username field", () => {
    expect(
      mapServerFieldErrors({
        status: 409,
        message: "x",
        code: "USERNAME_TAKEN",
      }),
    ).toEqual({ username: "usernameTaken" });
  });
  it("maps class-validator messages to fields", () => {
    expect(
      mapServerFieldErrors({
        status: 400,
        message: [
          "initialPassword must be longer than or equal to 8 characters",
          "username may only contain letters, numbers, underscores, and dots",
        ],
      }),
    ).toEqual({ password: "passwordTooShort", username: "usernameInvalid" });
  });
  it("returns null for unknown errors", () => {
    expect(mapServerFieldErrors({ status: 500, message: "boom" })).toBeNull();
    expect(mapServerFieldErrors(undefined)).toBeNull();
  });
});
