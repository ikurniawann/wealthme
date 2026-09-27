/**
 * "menu quick input harus di master dan co-master account saja" — the IAM
 * role editor / page-access matrix must not offer "Input Cepat" as a
 * grantable page for a custom role. It uses the same pattern already
 * established for `iam` itself: the page is simply absent from
 * `ACCESS_PAGES` (contracts), so `PAGE_GROUPS` (built by filtering
 * `NAV_SECTIONS` against that catalog) never includes its row.
 */
import { ACCESS_PAGES } from "@wealthme/contracts";

import { PAGE_GROUPS } from "./access-shared";

describe("PAGE_GROUPS / ACCESS_PAGES — quickinput is not grantable", () => {
  it("quickinput is not in the grantable ACCESS_PAGES catalog", () => {
    expect(ACCESS_PAGES).not.toContain("quickinput");
  });

  it("no page group row offers quickinput", () => {
    const allPages = PAGE_GROUPS.flatMap((g) => g.pages);
    expect(allPages).not.toContain("quickinput");
  });

  it("still offers every other sidebar page the Master can grant", () => {
    const allPages = PAGE_GROUPS.flatMap((g) => g.pages);
    expect(allPages).toContain("transaksi");
    expect(allPages).toContain("dana");
  });
});
