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

describe("buildHubs (bento v2 hub sidebar)", () => {
  // Required lazily so the auth-client mock above is in place first.
  const { resolveEffectiveAccess } = jest.requireActual(
    "@wealthme/contracts",
  ) as typeof import("@wealthme/contracts");
  const { PRIMARY_HUBS, SECONDARY_HUBS, buildHubs, isHubActive } =
    jest.requireActual(
      "./sidebar-sections",
    ) as typeof import("./sidebar-sections");

  test("a Master sees every hub, each with its full sub-page list", () => {
    const access = resolveEffectiveAccess({ role: "owner" });
    const primary = buildHubs(PRIMARY_HUBS, access);
    expect(primary.map((h) => h.id)).toEqual([
      "rekening",
      "transaksi",
      "ringkasan",
      "anggaran",
      "investasi",
      "tax",
      "persetujuan",
    ]);
    expect(
      primary.find((h) => h.id === "transaksi")?.children.map((c) => c.id),
    ).toEqual(["transaksi", "rekonsiliasi", "quickinput", "splitbill"]);
    expect(
      buildHubs(SECONDARY_HUBS, access)
        .find((h) => h.id === "masterdata")
        ?.children.map((c) => c.id),
    ).toContain("iam");
  });

  test("a dependant only gets the hubs their allowlist reaches, never IAM or quick input", () => {
    const access = resolveEffectiveAccess({ role: "dependant" });
    const hubs = [
      ...buildHubs(PRIMARY_HUBS, access),
      ...buildHubs(SECONDARY_HUBS, access),
    ];
    const ids = hubs.flatMap((h) => [h.id, ...h.children.map((c) => c.id)]);
    expect(ids).not.toContain("iam");
    expect(ids).not.toContain("quickinput");
    expect(ids).not.toContain("beranda");
    // Warisan is granted but Pajak is not: the hub still shows and opens Warisan.
    const tax = hubs.find((h) => h.id === "tax");
    expect(tax?.href).toBe("/warisan");
    expect(tax?.children.map((c) => c.id)).toEqual(["warisan"]);
  });

  test("no active membership means no hubs at all", () => {
    expect(buildHubs(PRIMARY_HUBS, null)).toEqual([]);
  });

  test("a hub is active on any of its sub-pages, including dynamic detail routes", () => {
    const access = resolveEffectiveAccess({ role: "owner" });
    const wealth = buildHubs(PRIMARY_HUBS, access).find(
      (h) => h.id === "investasi",
    )!;
    expect(isHubActive(wealth, "/aset/123")).toBe(true);
    expect(isHubActive(wealth, "/anggaran")).toBe(false);
  });
});

describe("resolveRail (sidebar collapse)", () => {
  const { resolveRail } = jest.requireActual(
    "./use-sidebar-rail",
  ) as typeof import("./use-sidebar-rail");
  test("the member's choice wins over the width default", () => {
    expect(resolveRail("collapsed", false)).toBe(true);
    expect(resolveRail("expanded", true)).toBe(false);
  });
  test("auto follows the 901-1439px rail default", () => {
    expect(resolveRail("auto", true)).toBe(true);
    expect(resolveRail("auto", false)).toBe(false);
  });
});
