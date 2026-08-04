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

  // EPIC-018 Task A4 — /asuransi, /kalkulator, /quickinput, /ai coverage
  // guards, mirroring the targeted checks A1/A2 added above.
  it("asuransi enum-keyed labels cover every insurance type/period/status in both locales without changing persisted values", () => {
    const typeIds = [
      "jiwa",
      "kesehatan",
      "kendaraan",
      "properti",
      "pendidikan",
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

  // EPIC-021 Group D (#14) — beneficiary editor copy exists in both locales.
  it("asuransi beneficiary-editor copy is present in both locales", () => {
    const keys = [
      "beneficiariesSectionTitle",
      "beneficiariesLabel",
      "beneficiaryNameLabel",
      "beneficiaryRelationshipLabel",
      "beneficiarySharePercentLabel",
      "beneficiaryMemberLabel",
      "beneficiaryMemberNoneOption",
      "addBeneficiaryButton",
      "removeBeneficiaryAriaLabel",
      "allocationAllocatedSuffix",
      "allocationUnallocatedSuffix",
      "allocationFullyAllocated",
      "validationSharePercentExceeded",
    ] as const;
    for (const key of keys) {
      expect(id.asuransi[key]).toBeTruthy();
      expect(en.asuransi[key]).toBeTruthy();
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

  // EPIC-018 Task A5 — /investasi, /aset, /liabilitas, /masterdata,
  // /mastercoa coverage guards, mirroring the targeted checks A1/A2/A4 added
  // above.
  it("investasi.typeLabels covers every instrument type in both locales without changing persisted values", () => {
    const typeIds = [
      "saham",
      "reksa_dana",
      "obligasi",
      "emas",
      "kripto",
      "lainnya",
    ] as const;
    for (const key of typeIds) {
      expect(id.investasi.typeLabels[key]).toBeTruthy();
      expect(en.investasi.typeLabels[key]).toBeTruthy();
    }
  });

  it("aset covers tabs, asset/account/investment type labels in both locales", () => {
    const tabIds = ["semua", "dana", "rekening", "investasi", "fisik"] as const;
    for (const key of tabIds) {
      expect(id.aset.tabs[key]).toBeTruthy();
      expect(en.aset.tabs[key]).toBeTruthy();
    }
    const assetTypeIds = [
      "properti",
      "kendaraan",
      "elektronik",
      "perhiasan",
      "lainnya",
    ] as const;
    for (const key of assetTypeIds) {
      expect(id.aset.assetTypeLabels[key]).toBeTruthy();
      expect(en.aset.assetTypeLabels[key]).toBeTruthy();
    }
    const accountTypeIds = [
      "bank",
      "ewallet",
      "cash",
      "investment",
      "property",
    ] as const;
    for (const key of accountTypeIds) {
      expect(id.aset.accountTypeLabels[key]).toBeTruthy();
      expect(en.aset.accountTypeLabels[key]).toBeTruthy();
    }
    // Regression guard for the explicit "Aset" (sidebar) vs "Aset Saya" (page
    // title) distinction is covered in the shell test above; this page's own
    // "Aset Fisik" tab label must stay distinct from the shell's "Aset".
    expect(id.aset.tabs.fisik).not.toBe(id.shell.navSections.aset);
  });

  it("liabilitas.typeLabels covers every liability type in both locales without changing persisted values", () => {
    const typeIds = [
      "kartu_kredit",
      "pinjaman_pribadi",
      "kpr",
      "kendaraan",
      "lainnya",
    ] as const;
    for (const key of typeIds) {
      expect(id.liabilitas.typeLabels[key]).toBeTruthy();
      expect(en.liabilitas.typeLabels[key]).toBeTruthy();
    }
  });

  it("masterdata.groups covers all 7 system reference groups with a title+label in both locales", () => {
    const groupIds = [
      "mdbank",
      "mdtxntype",
      "mdinvtype",
      "mdewallet",
      "mdlembaga",
      "mdasettype",
      "mdinstype",
    ] as const;
    expect(Object.keys(id.masterdata.groups)).toHaveLength(7);
    for (const key of groupIds) {
      expect(id.masterdata.groups[key].title).toBeTruthy();
      expect(id.masterdata.groups[key].label).toBeTruthy();
      expect(en.masterdata.groups[key].title).toBeTruthy();
      expect(en.masterdata.groups[key].label).toBeTruthy();
    }
  });

  it("mastercoa.groupLabels covers all 6 COA groups and direction/budget-type labels in both locales", () => {
    const groupNums = [1, 2, 3, 4, 5, 6] as const;
    for (const key of groupNums) {
      expect(id.mastercoa.groupLabels[key]).toBeTruthy();
      expect(en.mastercoa.groupLabels[key]).toBeTruthy();
    }
    const directionIds = ["INCOME", "EXPENSE", "TRANSFER"] as const;
    for (const key of directionIds) {
      expect(id.mastercoa.directionLabels[key]).toBeTruthy();
      expect(en.mastercoa.directionLabels[key]).toBeTruthy();
    }
    const budgetTypeIds = ["FIXED", "VARIABLE", "REIMBURSEMENT"] as const;
    for (const key of budgetTypeIds) {
      expect(id.mastercoa.budgetTypeLabels[key]).toBeTruthy();
      expect(en.mastercoa.budgetTypeLabels[key]).toBeTruthy();
    }
  });

  // EPIC-018 Task A6 — /notifikasi, /dana, /ringkasan, /tujuan, /tax,
  // /rekening, /donation, /warisan, /anggaran, /transaksi, /splitbill,
  // /rekonsiliasi coverage guards, mirroring the targeted checks A1/A2/A4/A5
  // added above.
  it("tujuan.statusLabels covers every goal status in both locales without changing persisted values", () => {
    const statusIds = [
      "achieved",
      "on_track",
      "needs_boost",
      "at_risk",
    ] as const;
    for (const key of statusIds) {
      expect(id.tujuan.statusLabels[key]).toBeTruthy();
      expect(en.tujuan.statusLabels[key]).toBeTruthy();
    }
  });

  it("tax covers SPT-status, PTKP, and bracket labels in both locales without changing persisted values", () => {
    const sptStatusIds = ["belum_lapor", "sudah_lapor", "terlambat"] as const;
    for (const key of sptStatusIds) {
      expect(id.tax.sptStatusLabels[key]).toBeTruthy();
      expect(en.tax.sptStatusLabels[key]).toBeTruthy();
    }
    const ptkpIds = ["tk0", "k0", "k1", "k2", "k3"] as const;
    for (const key of ptkpIds) {
      expect(id.tax.ptkpLabels[key]).toBeTruthy();
      expect(en.tax.ptkpLabels[key]).toBeTruthy();
    }
    const bracketIds = ["b0", "b1", "b2", "b4"] as const;
    for (const key of bracketIds) {
      expect(id.tax.bracketLabels[key]).toBeTruthy();
      expect(en.tax.bracketLabels[key]).toBeTruthy();
    }
  });

  it("rekening.typeLabels covers every account type in both locales with page-local wording", () => {
    const typeIds = [
      "bank",
      "ewallet",
      "cash",
      "investment",
      "property",
    ] as const;
    for (const key of typeIds) {
      expect(id.rekening.typeLabels[key]).toBeTruthy();
      expect(en.rekening.typeLabels[key]).toBeTruthy();
    }
    // Regression guard: /rekening's "bank" wording is intentionally distinct
    // from /aset's accountTypeLabels.bank — different context, different copy.
    expect(id.rekening.typeLabels.bank).not.toBe(
      id.aset.accountTypeLabels.bank,
    );
  });

  it("donation covers every donation type (list + select-option wording) in both locales without changing persisted values", () => {
    const typeIds = [
      "zakat_maal",
      "zakat_fitrah",
      "infaq",
      "sedekah",
      "wakaf",
      "lainnya",
    ] as const;
    for (const key of typeIds) {
      expect(id.donation.typeLabels[key]).toBeTruthy();
      expect(en.donation.typeLabels[key]).toBeTruthy();
      expect(id.donation.jenisOptionLabels[key]).toBeTruthy();
      expect(en.donation.jenisOptionLabels[key]).toBeTruthy();
    }
  });

  it("anggaran covers budget-type and period labels in both locales without changing persisted values", () => {
    const budgetTypeIds = [
      "FIXED",
      "VARIABLE",
      "REIMBURSEMENT",
      "OTHER",
    ] as const;
    for (const key of budgetTypeIds) {
      expect(id.anggaran.budgetTypeLabels[key]).toBeTruthy();
      expect(en.anggaran.budgetTypeLabels[key]).toBeTruthy();
    }
    const periodIds = ["monthly", "weekly", "yearly"] as const;
    for (const key of periodIds) {
      expect(id.anggaran.periodLabels[key]).toBeTruthy();
      expect(en.anggaran.periodLabels[key]).toBeTruthy();
    }
  });

  it("transaksi covers type, filter, and sort labels in both locales without changing persisted values", () => {
    const typeIds = ["income", "expense", "transfer"] as const;
    for (const key of typeIds) {
      expect(id.transaksi.typeLabels[key]).toBeTruthy();
      expect(en.transaksi.typeLabels[key]).toBeTruthy();
    }
    const filterIds = [
      "all",
      "income",
      "expense",
      "transfer",
      "kartu_kredit",
    ] as const;
    for (const key of filterIds) {
      expect(id.transaksi.filterLabels[key]).toBeTruthy();
      expect(en.transaksi.filterLabels[key]).toBeTruthy();
    }
    const sortIds = ["newest", "oldest"] as const;
    for (const key of sortIds) {
      expect(id.transaksi.sortLabels[key]).toBeTruthy();
      expect(en.transaksi.sortLabels[key]).toBeTruthy();
    }
  });

  it("rekonsiliasi.steps covers all 4 wizard steps with a label+sub in both locales", () => {
    const stepNums = [1, 2, 3, 4] as const;
    for (const key of stepNums) {
      expect(id.rekonsiliasi.steps[key].label).toBeTruthy();
      expect(id.rekonsiliasi.steps[key].sub).toBeTruthy();
      expect(en.rekonsiliasi.steps[key].label).toBeTruthy();
      expect(en.rekonsiliasi.steps[key].sub).toBeTruthy();
    }
  });

  it("notifikasi, dana, ringkasan, warisan, and splitbill expose non-empty core copy in both locales", () => {
    expect(id.notifikasi.title).toBeTruthy();
    expect(en.notifikasi.title).toBeTruthy();
    expect(id.dana.totalLabel).toBeTruthy();
    expect(en.dana.totalLabel).toBeTruthy();
    expect(id.ringkasan.totalNetWorthLabel).toBeTruthy();
    expect(en.ringkasan.totalNetWorthLabel).toBeTruthy();
    expect(id.warisan.heroTitle).toBeTruthy();
    expect(en.warisan.heroTitle).toBeTruthy();
    expect(id.splitbill.createButton).toBeTruthy();
    expect(en.splitbill.createButton).toBeTruthy();
  });

  // EPIC-021 #3 — /dana's cash section became a real, plural CRUD list
  // (like e-wallet), sharing entity-aware toast copy instead of separate
  // ewallet-only toast strings.
  it("dana.entityLabels covers both cash and ewallet entities in both locales without changing persisted values", () => {
    const entityIds = ["cash", "ewallet"] as const;
    for (const key of entityIds) {
      expect(id.dana.entityLabels[key]).toBeTruthy();
      expect(en.dana.entityLabels[key]).toBeTruthy();
    }
    expect(id.dana.emptyCash).toBeTruthy();
    expect(en.dana.emptyCash).toBeTruthy();
  });

  // EPIC-018 Task A3 — /laporan (the last untranslated page) coverage
  // guards: 16 tab sections, the shared period filter, and the export
  // panel, mirroring the targeted checks A1/A2/A4/A5/A6 added above.
  it("laporan.months has exactly 12 entries and the shared period filter/export copy is present in both locales", () => {
    expect(id.laporan.months).toHaveLength(12);
    expect(en.laporan.months).toHaveLength(12);
    expect(id.laporan.periodFilter.allDatesOption).toBeTruthy();
    expect(en.laporan.periodFilter.allDatesOption).toBeTruthy();
    expect(id.laporan.subtitle).toBeTruthy();
    expect(en.laporan.subtitle).toBeTruthy();
  });

  it("laporan hoists exact-repeat phrases (Total Pemasukan, Surplus, Net Worth, ...) to the top level in both locales", () => {
    const sharedKeys = [
      "totalIncomeLabel",
      "totalExpenseLabel",
      "surplusLabel",
      "savingsRateLabel",
      "totalAssetsLabel",
      "totalLiabilitiesLabel",
      "netWorthLabel",
      "emptyMonthTransactions",
    ] as const;
    for (const key of sharedKeys) {
      expect(id.laporan[key]).toBeTruthy();
      expect(en.laporan[key]).toBeTruthy();
    }
  });

  it("laporan.family.roleLabels covers every family-report role in both locales without changing persisted values", () => {
    const roleIds = ["owner", "admin", "member"] as const;
    for (const key of roleIds) {
      expect(id.laporan.family.roleLabels[key]).toBeTruthy();
      expect(en.laporan.family.roleLabels[key]).toBeTruthy();
    }
  });

  it("laporan.investasi.typeLabels covers every instrument type in both locales without changing persisted values", () => {
    const typeIds = [
      "saham",
      "reksa_dana",
      "obligasi",
      "emas",
      "kripto",
      "lainnya",
    ] as const;
    for (const key of typeIds) {
      expect(id.laporan.investasi.typeLabels[key]).toBeTruthy();
      expect(en.laporan.investasi.typeLabels[key]).toBeTruthy();
    }
  });

  it("laporan.export.reportTypeLabels covers every export report type in both locales without changing persisted values", () => {
    const reportTypeIds = [
      "summary",
      "bank",
      "detail",
      "pnl",
      "balance-sheet",
      "cashflow",
    ] as const;
    for (const key of reportTypeIds) {
      expect(id.laporan.export.reportTypeLabels[key]).toBeTruthy();
      expect(en.laporan.export.reportTypeLabels[key]).toBeTruthy();
    }
    // Honest-UI fix: the "Export Excel" button always downloaded a CSV
    // (buildCsv server-side) — relabeled to "Export CSV" in both locales.
    expect(id.laporan.export.csvButton).toBe("Export CSV");
    expect(en.laporan.export.csvButton).toBe("Export CSV");
    expect(id.laporan.export.pdfButton).toBe("Export PDF");
    expect(en.laporan.export.pdfButton).toBe("Export PDF");
  });

  it("laporan tab sections (harian, bulanan, tahunan, bank, detail, aliran, pnl, balance, cashflow, kas, asetLiabilitas, performa, pajak) expose non-empty core copy in both locales", () => {
    expect(id.laporan.harian.txnTodayTitle).toBeTruthy();
    expect(en.laporan.harian.txnTodayTitle).toBeTruthy();
    expect(id.laporan.bulanan.title).toBeTruthy();
    expect(en.laporan.bulanan.title).toBeTruthy();
    expect(id.laporan.tahunan.title).toBeTruthy();
    expect(en.laporan.tahunan.title).toBeTruthy();
    expect(id.laporan.bank.title).toBeTruthy();
    expect(en.laporan.bank.title).toBeTruthy();
    expect(id.laporan.detail.title).toBeTruthy();
    expect(en.laporan.detail.title).toBeTruthy();
    expect(id.laporan.aliran.title).toBeTruthy();
    expect(en.laporan.aliran.title).toBeTruthy();
    expect(id.laporan.pnl.revenueLabel).toBeTruthy();
    expect(en.laporan.pnl.revenueLabel).toBeTruthy();
    expect(id.laporan.balance.assetLabel).toBeTruthy();
    expect(en.laporan.balance.assetLabel).toBeTruthy();
    expect(id.laporan.cashflow.operatingLabel).toBeTruthy();
    expect(en.laporan.cashflow.operatingLabel).toBeTruthy();
    expect(id.laporan.kas.title).toBeTruthy();
    expect(en.laporan.kas.title).toBeTruthy();
    expect(id.laporan.asetLiabilitas.ratioTitle).toBeTruthy();
    expect(en.laporan.asetLiabilitas.ratioTitle).toBeTruthy();
    expect(id.laporan.performa.title).toBeTruthy();
    expect(en.laporan.performa.title).toBeTruthy();
    expect(id.laporan.pajak.title).toBeTruthy();
    expect(en.laporan.pajak.title).toBeTruthy();
  });
});
