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
});
