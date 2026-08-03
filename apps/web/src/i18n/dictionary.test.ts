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
    expect(en.akun.keamanan.currentSessionSub).toBe("Jakarta · Active now");
    expect(en.akun.koneksi.connectedSync).toBe("Connected · Sync active");
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

  // EPIC-018 Task A4 — /asuransi, /kalkulator, /quickinput, /ai coverage
  // guards, mirroring the targeted checks A1/A2 added above.
  it("asuransi enum-keyed labels cover every insurance type/period/status in both locales without changing persisted values", () => {
    const typeIds = [
      "jiwa",
      "kesehatan",
      "kendaraan",
      "properti",
      "lainnya",
    ] as const;
    for (const key of typeIds) {
      expect(id.asuransi.typeLabels[key]).toBeTruthy();
      expect(en.asuransi.typeLabels[key]).toBeTruthy();
    }
    const periodIds = ["monthly", "quarterly", "yearly"] as const;
    for (const key of periodIds) {
      expect(id.asuransi.periodSuffixLabels[key]).toBeTruthy();
      expect(en.asuransi.periodSuffixLabels[key]).toBeTruthy();
      expect(id.asuransi.periodOptionLabels[key]).toBeTruthy();
      expect(en.asuransi.periodOptionLabels[key]).toBeTruthy();
    }
    const statusIds = ["aktif", "tidak_aktif", "kadaluarsa"] as const;
    for (const key of statusIds) {
      expect(id.asuransi.statusLabels[key]).toBeTruthy();
      expect(en.asuransi.statusLabels[key]).toBeTruthy();
    }
  });

  it("kalkulator.tabs covers all 7 sub-tools and months has exactly 12 entries in both locales", () => {
    const tabIds = [
      "zakat",
      "pph21",
      "investasi",
      "kredit",
      "pensiun",
      "tabungan",
      "splitgroup",
    ] as const;
    for (const key of tabIds) {
      expect(id.kalkulator.tabs[key]).toBeTruthy();
      expect(en.kalkulator.tabs[key]).toBeTruthy();
    }
    expect(id.kalkulator.months).toHaveLength(12);
    expect(en.kalkulator.months).toHaveLength(12);
  });

  it("quickinput.cards covers all 12 quick-action cards with non-empty name/desc in both locales", () => {
    const cardIds = [
      "transaksi",
      "investasi",
      "rekening",
      "ewallet",
      "aset",
      "liabilitas",
      "asuransi",
      "tujuan",
      "anggaran",
      "warisan",
      "donasi",
      "splitbill",
    ] as const;
    expect(Object.keys(id.quickinput.cards)).toHaveLength(12);
    for (const key of cardIds) {
      expect(id.quickinput.cards[key].name).toBeTruthy();
      expect(id.quickinput.cards[key].desc).toBeTruthy();
      expect(en.quickinput.cards[key].name).toBeTruthy();
      expect(en.quickinput.cards[key].desc).toBeTruthy();
    }
  });

  it("ai.chips carries exactly 6 popular-question chips with non-empty text in both locales", () => {
    expect(id.ai.chips).toHaveLength(6);
    expect(en.ai.chips).toHaveLength(6);
    for (const chip of id.ai.chips) expect(chip).toBeTruthy();
    for (const chip of en.ai.chips) expect(chip).toBeTruthy();
  });
});
