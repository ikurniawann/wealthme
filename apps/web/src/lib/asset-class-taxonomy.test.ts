// B7 (client revision round 2) — the shared asset-class taxonomy
// (@wealthme/contracts) is what unifies /aset "type", /investasi "type" and
// /warisan "Category" into one label set. These mappers are total (never
// throw, always fall back to "lainnya") so they are safe against any live
// production value, including a legacy/typo'd warisan free-text category.
import {
  accountTypeToAssetClass,
  ASSET_CLASS_KEYS,
  assetTypeToAssetClass,
  investmentTypeToAssetClass,
  warisanAssetTypeToAssetClass,
  type AssetClassKey,
} from "@wealthme/contracts";

describe("ASSET_CLASS_KEYS", () => {
  it("lists exactly the ten canonical classes from the brief, once each", () => {
    expect(ASSET_CLASS_KEYS).toHaveLength(10);
    expect(new Set(ASSET_CLASS_KEYS).size).toBe(10);
    expect(ASSET_CLASS_KEYS).toEqual(
      expect.arrayContaining([
        "properti",
        "kendaraan",
        "kas_tabungan",
        "deposito",
        "saham",
        "reksa_dana",
        "obligasi",
        "emas",
        "kripto",
        "lainnya",
      ] satisfies AssetClassKey[]),
    );
  });
});

describe("assetTypeToAssetClass (/aset AssetType enum)", () => {
  it.each([
    ["properti", "properti"],
    ["kendaraan", "kendaraan"],
    ["emas", "emas"],
    // Elektronik/Perhiasan are real, unchanged stored types that fold into
    // the coarser "lainnya" display bucket — the brief's taxonomy has no
    // entry of its own for either.
    ["elektronik", "lainnya"],
    ["perhiasan", "lainnya"],
    ["lainnya", "lainnya"],
  ] as const)("%s -> %s", (input, expected) => {
    expect(assetTypeToAssetClass(input)).toBe(expected);
  });

  it("never throws on an unrecognized value — falls back to lainnya", () => {
    expect(assetTypeToAssetClass("something-unknown")).toBe("lainnya");
  });
});

describe("investmentTypeToAssetClass (/investasi InvestmentType enum)", () => {
  it.each([
    ["saham", "saham"],
    ["reksa_dana", "reksa_dana"],
    ["obligasi", "obligasi"],
    ["emas", "emas"],
    ["kripto", "kripto"],
    ["deposito", "deposito"],
    ["lainnya", "lainnya"],
  ] as const)("%s -> %s", (input, expected) => {
    expect(investmentTypeToAssetClass(input)).toBe(expected);
  });
});

describe("accountTypeToAssetClass (/aset Dana & Rekening AccountType enum)", () => {
  it.each([
    ["property", "properti"],
    ["bank", "kas_tabungan"],
    ["ewallet", "kas_tabungan"],
    ["cash", "kas_tabungan"],
    ["investment", "kas_tabungan"],
  ] as const)("%s -> %s", (input, expected) => {
    expect(accountTypeToAssetClass(input)).toBe(expected);
  });
});

describe("warisanAssetTypeToAssetClass (free-text InheritanceAsset.assetType)", () => {
  it.each([
    ["Aset / Properti", "properti"],
    ["Cash / Tunai", "kas_tabungan"],
    ["Surat Berharga", "obligasi"],
    ["Saham", "saham"],
    ["Emas", "emas"],
    ["Lainnya", "lainnya"],
  ] as const)(
    "existing warisan option %s -> %s (no data migration needed)",
    (input, expected) => {
      expect(warisanAssetTypeToAssetClass(input)).toBe(expected);
    },
  );

  it("is case-insensitive and trims whitespace", () => {
    expect(warisanAssetTypeToAssetClass("  saham  ")).toBe("saham");
    expect(warisanAssetTypeToAssetClass("SAHAM")).toBe("saham");
  });

  it("never throws on a legacy/typo'd free-text category — falls back to lainnya", () => {
    expect(warisanAssetTypeToAssetClass("Warisan Keluarga Tak Terduga")).toBe(
      "lainnya",
    );
  });
});
