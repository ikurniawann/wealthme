/**
 * Batch 5 item 1 — same fix as `sidebar-sections.test.tsx`, for the mobile
 * bottom nav's local `isMobileNavItemActive` helper.
 */
// Same mock precedent as `sidebar-sections.test.tsx` — importing the
// component module pulls in `useSession` via auth-compat -> auth-client.
jest.mock("../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({ data: null, isPending: false })),
    signOut: jest.fn(),
  },
}));

import { isMobileNavItemActive } from "./mobile-bars";

describe("isMobileNavItemActive", () => {
  test("marks the list page active on an exact match", () => {
    expect(isMobileNavItemActive("/aset", "/aset")).toBe(true);
  });

  test("marks the parent nav item active on a dynamic detail sub-route", () => {
    expect(isMobileNavItemActive("/aset/123", "/aset")).toBe(true);
  });

  test("does not mark a sibling item active on another item's sub-route", () => {
    expect(isMobileNavItemActive("/aset/123", "/asuransi")).toBe(false);
  });

  test("does not false-positive on a route that merely starts with the href text", () => {
    expect(isMobileNavItemActive("/asetx", "/aset")).toBe(false);
  });
});
