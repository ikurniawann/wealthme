import { resolveEffectiveAccess } from "@wealthme/contracts";

import {
  NAV_SECTIONS,
  canRecordTransaction,
  isNavItemVisibleForAccess,
  isRouteAllowedForAccess,
  mobileNavForAccess,
} from "./nav";

const items = NAV_SECTIONS.flatMap((s) => s.items);
const visibleIds = (access: Parameters<typeof isNavItemVisibleForAccess>[1]) =>
  items.filter((i) => isNavItemVisibleForAccess(i, access)).map((i) => i.id);

describe("EPIC-030 access-driven nav", () => {
  it("Master sees everything, IAM included", () => {
    const ids = visibleIds(resolveEffectiveAccess({ role: "owner" }));
    expect(ids).toEqual(items.map((i) => i.id));
  });

  it("a legacy dependant keeps exactly the old allowlist", () => {
    const ids = visibleIds(resolveEffectiveAccess({ role: "dependant" }));
    expect(ids.sort()).toEqual(
      [
        "transaksi",
        "dana",
        "rekening",
        "warisan",
        "notifikasi",
        "quickinput",
        "panduan",
      ].sort(),
    );
  });

  it("a legacy member keeps the old menu minus owner-only items", () => {
    const ids = visibleIds(resolveEffectiveAccess({ role: "member" }));
    const expected = items.filter((i) => !i.ownerOnly).map((i) => i.id);
    expect(ids).toEqual(expected);
  });

  it("a custom role shows only its pages; IAM is never granted", () => {
    const access = resolveEffectiveAccess({
      role: "member",
      accessRole: { dataScope: "own", permissions: { tujuan: "view" } },
    });
    expect(visibleIds(access).sort()).toEqual(
      ["tujuan", "notifikasi", "panduan"].sort(),
    );
    expect(isRouteAllowedForAccess("/iam", access)).toBe(false);
    expect(isRouteAllowedForAccess("/tujuan", access)).toBe(true);
    expect(isRouteAllowedForAccess("/investasi", access)).toBe(false);
    expect(isRouteAllowedForAccess("/akun", access)).toBe(true);
    expect(isRouteAllowedForAccess("/", access)).toBe(false);
  });

  it("loading is permissive, no membership is closed", () => {
    expect(isRouteAllowedForAccess("/investasi", undefined)).toBe(true);
    expect(visibleIds(null)).toEqual([]);
    expect(isRouteAllowedForAccess("/beranda", null)).toBe(false);
    expect(isRouteAllowedForAccess("/akses-saya", null)).toBe(true);
    expect(mobileNavForAccess(null).map((i) => i.id)).toEqual([
      "akses-saya",
      "notifikasi",
      "panduan",
      "akun",
    ]);
  });

  it("mobile bar always has four items and falls back to akses-saya", () => {
    const view = resolveEffectiveAccess({
      role: "member",
      accessRole: { dataScope: "all", permissions: { tujuan: "view" } },
    });
    const bar = mobileNavForAccess(view).map((i) => i.id);
    expect(bar).toHaveLength(4);
    expect(bar[0]).toBe("akses-saya");
    expect(bar[3]).toBe("akun");
    expect(new Set(bar).size).toBe(4);
  });

  it("the add-transaction button needs transaksi or quickinput manage", () => {
    expect(
      canRecordTransaction(resolveEffectiveAccess({ role: "dependant" })),
    ).toBe(true);
    expect(
      canRecordTransaction(
        resolveEffectiveAccess({
          role: "member",
          accessRole: { dataScope: "all", permissions: { transaksi: "view" } },
        }),
      ),
    ).toBe(false);
  });
});
