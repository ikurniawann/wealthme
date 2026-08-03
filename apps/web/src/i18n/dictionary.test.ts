/**
 * EPIC-018 Task A1 — i18n dictionary key parity.
 *
 * `id.ts` and `en.ts` both use `satisfies I18nDictionary`, so TypeScript
 * already rejects a missing/extra key at compile time. This is a runtime
 * double-check (belt-and-suspenders) so a missed translation fails a test
 * even if the type-level guarantee is ever weakened — e.g. `shell.navSections`
 * / `reportTabs` / `pageTitles` / `mobileNav` are keyed by literal-union id
 * types derived from `@/lib/nav`; if those unions were ever loosened to a
 * plain index signature, this test still catches drift between locales.
 */

import { id } from "./id";
import { en } from "./en";

/** Recursively collects dotted key paths for plain (non-array) objects. */
function collectKeyPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.keys(value as Record<string, unknown>).flatMap((key) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const nested = collectKeyPaths(
      (value as Record<string, unknown>)[key],
      path,
    );
    return nested.length > 0 ? nested : [path];
  });
}

describe("i18n dictionary key parity", () => {
  it("id and en dictionaries expose exactly the same key paths", () => {
    const idKeys = collectKeyPaths(id).sort();
    const enKeys = collectKeyPaths(en).sort();
    expect(enKeys).toEqual(idKeys);
  });

  it("shell.navSections covers every NAV_ITEM_ID with a non-empty translation in both locales", () => {
    for (const key of Object.keys(id.shell.navSections)) {
      expect(
        id.shell.navSections[key as keyof typeof id.shell.navSections],
      ).toBeTruthy();
      expect(
        en.shell.navSections[key as keyof typeof en.shell.navSections],
      ).toBeTruthy();
    }
  });

  it("shell.pageTitles covers the aset (sidebar) vs aset (page title) distinction", () => {
    // Regression guard for the explicit "Aset" (sidebar) vs "Aset Saya" (page
    // title) requirement — two different surfaces, intentionally different copy.
    expect(id.shell.navSections.aset).toBe("Aset");
    expect(id.shell.pageTitles.aset).toBe("Aset Saya");
    expect(id.shell.navSections.aset).not.toBe(id.shell.pageTitles.aset);
  });

  // EPIC-018 Task A2 — /akun + /panduan coverage guards, mirroring the
  // targeted checks Task A1 added above (the recursive key-path test already
  // catches an id/en mismatch; these guard the specific shapes A2 landed on).
  it("akun.subpageTitles covers every /akun sub-page with a non-empty translation in both locales", () => {
    const subpageIds = [
      "profil",
      "keamanan",
      "koneksi",
      "pengaturan",
      "notif-setting",
      "privasi",
      "bantuan",
      "hubungi",
      "tentang",
      "family",
    ] as const;
    for (const key of subpageIds) {
      expect(id.akun.subpageTitles[key]).toBeTruthy();
      expect(en.akun.subpageTitles[key]).toBeTruthy();
    }
  });

  it("akun localizes dynamic option/status/role copy without changing Indonesian source values", () => {
    expect(id.akun.profil.genderOptions).toEqual({
      male: "Laki-laki",
      female: "Perempuan",
    });
    expect(en.akun.profil.genderOptions).toEqual({
      male: "Male",
      female: "Female",
    });
    // EPIC-016 Task C/K — the fake "connected/synced" bank badges and the
    // mock "Jakarta · Active now" session copy were removed in favor of real
    // account data and real `authClient.listSessions()` rows; assert their
    // honest replacements instead.
    expect(en.akun.keamanan.sessionActivePrefix).toBe("Active since ");
    expect(en.akun.koneksi.manualLabel).toBe("Manual");
  });

  it("akun.bantuan.faqs carries exactly the 6 FAQ entries with non-empty questions in both locales", () => {
    const faqKeys = Object.keys(id.akun.bantuan.faqs);
    expect(faqKeys).toHaveLength(6);
    for (const key of faqKeys as (keyof typeof id.akun.bantuan.faqs)[]) {
      expect(id.akun.bantuan.faqs[key].q).toBeTruthy();
      expect(en.akun.bantuan.faqs[key].q).toBeTruthy();
    }
  });

  it("panduan covers all 9 journeys and 24 features with non-empty translations in both locales", () => {
    // Matches the epic's inventory (9 journeys x title/subtitle + 24 nested
    // features x title/desc = 66 string fields) — guards against silently
    // dropping a journey/feature during the JOURNEYS structural refactor.
    const journeyKeys = Object.keys(id.panduan.journeys);
    const featureKeys = Object.keys(id.panduan.features);
    expect(journeyKeys).toHaveLength(9);
    expect(featureKeys).toHaveLength(24);
    for (const key of journeyKeys as (keyof typeof id.panduan.journeys)[]) {
      expect(id.panduan.journeys[key].title).toBeTruthy();
      expect(id.panduan.journeys[key].subtitle).toBeTruthy();
      expect(en.panduan.journeys[key].title).toBeTruthy();
      expect(en.panduan.journeys[key].subtitle).toBeTruthy();
    }
    for (const key of featureKeys as (keyof typeof id.panduan.features)[]) {
      expect(id.panduan.features[key].title).toBeTruthy();
      expect(id.panduan.features[key].desc).toBeTruthy();
      expect(en.panduan.features[key].title).toBeTruthy();
      expect(en.panduan.features[key].desc).toBeTruthy();
    }
  });
});
