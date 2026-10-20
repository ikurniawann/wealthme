import { BadRequestException } from "@nestjs/common";
import { INVESTMENT_PLATFORMS } from "@wealthme/contracts";

import { pocketCatalogEntry, resolvePocketCurrency } from "./pocket-rules.util";

// Client bug 2026-10-21 — "ajaib tidak bisa nambah wallet crypto": the
// catalog left kripto and the crypto pocket out of Ajaib, so both the
// pocket (400) and a kripto holding at Ajaib (400) were refused.
describe("pocket rules — platform catalog", () => {
  it("lets Ajaib keep a crypto pocket, fixed to IDR", () => {
    const ajaib = pocketCatalogEntry("ajaib");
    expect(ajaib.products).toContain("kripto");
    expect(resolvePocketCurrency(ajaib, "crypto", undefined)).toBe("IDR");
  });

  it("offers a crypto pocket on every platform that sells kripto", () => {
    const missing = INVESTMENT_PLATFORMS.filter(
      (p) => p.products.includes("kripto") && !p.pockets.includes("crypto"),
    ).map((p) => p.key);
    expect(missing).toEqual([]);
  });

  it("still refuses a pocket kind the platform does not offer", () => {
    expect(() =>
      resolvePocketCurrency(pocketCatalogEntry("gotrade"), "crypto", undefined),
    ).toThrow(BadRequestException);
  });
});
