/**
 * Batch 5 item 1 — the sidebar's active-state match must handle a dynamic
 * sub-route: `/aset/[id]` never equals `/aset`, so a strict `===` never
 * highlights "Aset" once you're on a detail page. `isNavItemActive` is the
 * pure match used by both call sites in `SidebarSections` (the group's
 * `holdsActive` open-state and each item's `active` prop) — testing it
 * directly avoids re-mocking `useSession`/`useMyAccess`/`useLocale`/
 * `useQuery` just to exercise a string comparison.
 */
// Importing the component module (even just for the pure helper below)
// pulls in `useSession` via auth-compat -> auth-client, which re-exports the
// `better-auth` React client (unparseable ESM in jest) — same mock
// precedent as `transaction-dialog.test.tsx` and every other
// `(app)/**/*.test.tsx` in this repo.
jest.mock("../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({ data: null, isPending: false })),
    signOut: jest.fn(),
  },
}));

import { excludeBrandDuplicate, isNavItemActive } from "./sidebar-sections";

describe("isNavItemActive", () => {
  test("marks the list page active on an exact match", () => {
    expect(isNavItemActive("/aset", "/aset")).toBe(true);
  });

  test("marks the parent nav item active on a dynamic detail sub-route", () => {
    expect(isNavItemActive("/aset/123", "/aset")).toBe(true);
  });

  test("does not mark a sibling item active on another item's sub-route", () => {
    expect(isNavItemActive("/aset/123", "/asuransi")).toBe(false);
  });

  test("does not false-positive on a route that merely starts with the href text", () => {
    // "/asetx" is not a real route in this app, but the match must key off
    // a path-segment boundary, not a bare string prefix.
    expect(isNavItemActive("/asetx", "/aset")).toBe(false);
  });

  test("does not mark the item active for an unrelated route", () => {
    expect(isNavItemActive("/beranda", "/aset")).toBe(false);
  });
});

describe("excludeBrandDuplicate", () => {
  test("drops the beranda item since the logo now links home", () => {
    const items = [{ id: "beranda" }, { id: "ringkasan" }, { id: "transaksi" }];
    expect(excludeBrandDuplicate(items).map((i) => i.id)).toEqual([
      "ringkasan",
      "transaksi",
    ]);
  });

  test("is a no-op when there is no beranda item", () => {
    const items = [{ id: "anggaran" }, { id: "tujuan" }];
    expect(excludeBrandDuplicate(items)).toEqual(items);
  });
});
