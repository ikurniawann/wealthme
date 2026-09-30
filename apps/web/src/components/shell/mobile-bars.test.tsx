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

describe("dockSlots (bento v2 pill dock)", () => {
  const { resolveEffectiveAccess } = jest.requireActual(
    "@wealthme/contracts",
  ) as typeof import("@wealthme/contracts");
  const { mobileNavForAccess } = jest.requireActual(
    "../../lib/nav",
  ) as typeof import("../../lib/nav");
  const { dockSlots } = jest.requireActual(
    "./mobile-bars",
  ) as typeof import("./mobile-bars");
  const shape = (slots: ReturnType<typeof dockSlots>) =>
    slots.map((s) => (s.kind === "link" ? s.item.id : s.kind));

  test("a Master gets Beranda, Transaksi, +, Laporan, Menu", () => {
    const items = mobileNavForAccess(resolveEffectiveAccess({ role: "owner" }));
    expect(shape(dockSlots(items, true))).toEqual([
      "beranda",
      "transaksi",
      "add",
      "laporan",
      "menu",
    ]);
  });

  test("Akun never takes a dock slot (it lives behind the avatar and launcher)", () => {
    const items = mobileNavForAccess(null);
    expect(shape(dockSlots(items, false))).not.toContain("akun");
  });

  test("the + is dropped for members who may not record a transaction", () => {
    const items = mobileNavForAccess(resolveEffectiveAccess({ role: "owner" }));
    expect(shape(dockSlots(items, false))).toEqual([
      "beranda",
      "transaksi",
      "laporan",
      "menu",
    ]);
  });
});
