import assert from "node:assert/strict";
import { test, describe } from "node:test";

const { shouldClearCacheOnUserChange } = await import("../auth-session.js");

describe("shouldClearCacheOnUserChange", () => {
  test("returns true when userId switches from A to B (the cross-login bug)", () => {
    assert.equal(shouldClearCacheOnUserChange("user-a", "user-b"), true);
  });

  test("returns false when userId stays the same (no logout/re-login)", () => {
    assert.equal(shouldClearCacheOnUserChange("user-a", "user-a"), false);
  });

  test("returns false on initial login (no previous userId)", () => {
    assert.equal(shouldClearCacheOnUserChange(null, "user-b"), false);
  });

  test("returns false when both are null (unauthenticated)", () => {
    assert.equal(shouldClearCacheOnUserChange(null, null), false);
  });

  test("returns true when session expires / forced logout (userId to null)", () => {
    assert.equal(shouldClearCacheOnUserChange("user-a", null), true);
  });

  test("handles undefined as null (same as no session)", () => {
    assert.equal(shouldClearCacheOnUserChange(undefined, "user-b"), false);
    assert.equal(shouldClearCacheOnUserChange("user-a", undefined), true);
  });
});
