import type { AnyTaxRuleEntry } from "../tax-rule.types";

const PMK_101_2016 =
  "https://jdih.kemenkeu.go.id/api/download/fulltext/2016/101~PMK.010~2016Per.pdf";
const PMK_168_2023 =
  "https://pajak.go.id/sites/default/files/2024-02/PMK%20168%20Tahun%202023%20Tentang%20PPh%20Pasal%2021%20TER.pdf";

export const PPH_RULES: readonly AnyTaxRuleEntry[] = [
  {
    key: "pph.pasal17",
    value: [
      { upTo: 60_000_000n, rateBps: 500, label: "0 – 60 Juta" },
      { upTo: 250_000_000n, rateBps: 1500, label: "60 – 250 Juta" },
      { upTo: 500_000_000n, rateBps: 2500, label: "250 – 500 Juta" },
      { upTo: 5_000_000_000n, rateBps: 3000, label: "500 Juta – 5 Miliar" },
      { upTo: null, rateBps: 3500, label: "> 5 Miliar" },
    ],
    effectiveFrom: "2022-01-01",
    effectiveTo: null,
    legalBasis: "UU 7/2021 (UU HPP) Pasal 17",
    source: null,
    verified: false,
    note: "R§2: unchanged through Sep 2026; primary UU text not fetched. Pre-2022 brackets not modelled.",
  },
  {
    key: "pph.ptkp",
    value: {
      base: 54_000_000n,
      marriedAddOn: 4_500_000n,
      dependentAddOn: 4_500_000n,
      maxDependents: 3,
      combinedWifeIncomeAddOn: 54_000_000n,
    },
    effectiveFrom: "2016-01-01",
    effectiveTo: null,
    legalBasis: "PMK 101/PMK.010/2016",
    source: PMK_101_2016,
    verified: false,
    note: "R§3: no change found for 2025/2026.",
  },
  {
    key: "pph.biayaJabatan",
    value: { rateBps: 500, capAnnual: 6_000_000n, capMonthly: 500_000n },
    effectiveFrom: "2016-01-01",
    effectiveTo: null,
    legalBasis: "PMK 168/2023 (biaya jabatan 5%, maks Rp6jt/thn)",
    source: PMK_168_2023,
    verified: false,
    note: "R§4.",
  },
  {
    key: "pph.pkpRounding",
    value: { unit: 1000n },
    effectiveFrom: "2016-01-01",
    effectiveTo: null,
    legalBasis: "Praktik DJP: PKP dibulatkan ke bawah ribuan penuh",
    source: null,
    verified: false,
    note: "Not in the research note; existing WealthMe behaviour (roundPkpDown) kept for parity.",
  },
  {
    key: "pph.zakat",
    value: { capToNeto: true },
    effectiveFrom: "2010-01-01",
    effectiveTo: null,
    legalBasis: "PP 60/2010; PMK 254/PMK.03/2010",
    source: null,
    verified: false,
    note: "R§4: deductible only via BAZNAS/official LAZ; cap to penghasilan neto is WealthMe's reading.",
  },
  {
    key: "pph.nppn",
    value: { table: null },
    effectiveFrom: "2015-01-01",
    effectiveTo: null,
    legalBasis: "PER-17/PJ/2015",
    source:
      "https://www.pajak.go.id/sites/default/files/2019-03/PER%20-%2017.PJ_.2015.pdf",
    verified: false,
    note: "R§4: percentage table not retrieved; the user enters the NPPN % for their profession/region.",
  },
];
