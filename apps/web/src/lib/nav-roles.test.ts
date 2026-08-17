/**
 * Role-scoped navigation (Anak / Staff Operasional).
 *
 * The allowlist in `nav.ts` mirrors what `casl-ability.factory.ts` grants
 * `dependant`/`operational` and what `assertHouseholdWideReadAllowed` denies
 * them. These tests pin that mapping so a future nav entry cannot silently
 * become visible to a child: adding an item to NAV_SECTIONS without adding it
 * to the allowlist keeps it hidden (safe by default), and adding it to the
 * allowlist has to be a deliberate edit that flips a case here.
 */
import {
  MOBILE_NAV,
  isNavItemVisibleForRole,
  isRouteAllowedForRole,
  isRowScopedRole,
  mobileNavForRole,
} from "./nav";

const item = (id: string, ownerOnly = false) =>
  ({ id, ownerOnly }) as Parameters<typeof isNavItemVisibleForRole>[0];

describe("isRowScopedRole", () => {
  it("is true only for dependant and operational", () => {
    expect(isRowScopedRole("dependant")).toBe(true);
    expect(isRowScopedRole("operational")).toBe(true);
    for (const r of [
      "owner",
      "spouse",
      "member",
      "admin_staff",
      null,
      undefined,
    ])
      expect(isRowScopedRole(r)).toBe(false);
  });
});

describe("isNavItemVisibleForRole — Anak (dependant)", () => {
  it("hides every household-wealth surface the API denies", () => {
    // /dashboard + /reports are blocked by assertHouseholdWideReadAllowed;
    // Asset/Liability/Investment/Budget/Goal/Insurance/TaxRecord have no
    // CASL grant for this role at all.
    for (const id of [
      "beranda",
      "ringkasan",
      "laporan",
      "aset",
      "liabilitas",
      "investasi",
      "anggaran",
      "tujuan",
      "asuransi",
      "donation",
      "tax",
      "splitbill",
      "rekonsiliasi",
      "ai",
      "kalkulator",
      "mastercoa",
    ]) {
      expect(isNavItemVisibleForRole(item(id), "dependant")).toBe(false);
    }
  });

  it("keeps the surfaces it is actually granted", () => {
    for (const id of [
      "transaksi",
      "dana",
      "rekening",
      "notifikasi",
      "quickinput",
      "panduan",
    ])
      expect(isNavItemVisibleForRole(item(id), "dependant")).toBe(true);
  });

  it("still hides owner-only admin surfaces", () => {
    for (const id of ["iam", "masterdata", "persetujuan"])
      expect(isNavItemVisibleForRole(item(id, true), "dependant")).toBe(false);
  });

  it("grants warisan to dependant but NOT operational — read Inheritance is dependant-only", () => {
    expect(isNavItemVisibleForRole(item("warisan"), "dependant")).toBe(true);
    expect(isNavItemVisibleForRole(item("warisan"), "operational")).toBe(false);
  });
});

describe("isNavItemVisibleForRole — trusted roles are unchanged", () => {
  it("owner sees owner-only items; member does not", () => {
    expect(isNavItemVisibleForRole(item("iam", true), "owner")).toBe(true);
    expect(isNavItemVisibleForRole(item("iam", true), "member")).toBe(false);
  });

  it("member still sees every non-owner-only item", () => {
    for (const id of ["beranda", "laporan", "aset", "kalkulator"])
      expect(isNavItemVisibleForRole(item(id), "member")).toBe(true);
  });
});

describe("isRouteAllowedForRole", () => {
  it("bounces a child off denied routes but not its own", () => {
    for (const p of ["/beranda", "/laporan", "/aset", "/iam"])
      expect(isRouteAllowedForRole(p, "dependant")).toBe(false);
    for (const p of ["/transaksi", "/dana", "/warisan", "/panduan"])
      expect(isRouteAllowedForRole(p, "dependant")).toBe(true);
  });

  it("always allows the landing page and own profile, so the guard cannot loop", () => {
    for (const role of ["dependant", "operational"]) {
      expect(isRouteAllowedForRole("/akses-saya", role)).toBe(true);
      expect(isRouteAllowedForRole("/akun", role)).toBe(true);
    }
  });

  it("never restricts a trusted role", () => {
    for (const p of ["/beranda", "/iam", "/laporan"])
      expect(isRouteAllowedForRole(p, "owner")).toBe(true);
  });
});

describe("mobileNavForRole", () => {
  it("replaces the 403-bound beranda/laporan buttons for a child", () => {
    const ids = mobileNavForRole("dependant").map((i) => i.id);
    expect(ids).toEqual(["akses-saya", "transaksi", "notifikasi", "akun"]);
    // Must stay EVEN: the round add-transaction FAB is centred at left:50%
    // over this bar, which is a gap between items only for an even count.
    expect(ids.length % 2).toBe(0);
    expect(ids).not.toContain("beranda");
    expect(ids).not.toContain("laporan");
  });

  it("leaves the bar untouched for trusted roles", () => {
    expect(mobileNavForRole("owner")).toBe(MOBILE_NAV);
    expect(mobileNavForRole(null)).toBe(MOBILE_NAV);
  });
});
