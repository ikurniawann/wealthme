// B7 (client revision round 2, polish-j) — ONE shared asset-class taxonomy
// used for DISPLAY across /aset, /investasi and /warisan, which each grew
// their own incompatible category set (Warisan's free-text "Category" vs
// Investasi's "Type" enum vs Aset's own type enum). Per the brief's
// decision: unify the LABELS everywhere first, without any data-loss risk —
// none of the underlying storage (Prisma `AssetType`/`InvestmentType` enums,
// InheritanceAsset.assetType free string) changes shape or values here.
// Every mapping below is total (every known + unknown input falls back to
// "lainnya", never throws) so a mapper is safe to call on live production
// data, including any legacy/typo'd free-text warisan category.

/** The ten canonical asset classes shown everywhere a category/type badge renders. */
export type AssetClassKey =
  | "properti"
  | "kendaraan"
  | "kas_tabungan"
  | "deposito"
  | "saham"
  | "reksa_dana"
  | "obligasi"
  | "emas"
  | "kripto"
  | "lainnya";

/** Display order used by every "Kategori" filter/legend built from this taxonomy. */
export const ASSET_CLASS_KEYS: readonly AssetClassKey[] = [
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
];

/**
 * Mirrors Prisma's `AssetType` enum (apps/api/prisma/schema.prisma) —
 * /aset physical-asset types. `elektronik` and `perhiasan` are real,
 * separately-stored types (unchanged) that fold into the coarser "lainnya"
 * display bucket, matching the brief's canonical list (which has no
 * Elektronik/Perhiasan entry of its own).
 */
export function assetTypeToAssetClass(type: string): AssetClassKey {
  switch (type) {
    case "properti":
      return "properti";
    case "kendaraan":
      return "kendaraan";
    case "emas":
      return "emas";
    case "elektronik":
    case "perhiasan":
    case "seni_koleksi":
    case "lainnya":
    default:
      return "lainnya";
  }
}

/** Mirrors Prisma's `InvestmentType` enum — /investasi instrument types. */
export function investmentTypeToAssetClass(type: string): AssetClassKey {
  switch (type) {
    case "saham":
      return "saham";
    case "reksa_dana":
      return "reksa_dana";
    case "obligasi":
      return "obligasi";
    case "emas":
      return "emas";
    case "kripto":
      return "kripto";
    case "deposito":
      return "deposito";
    case "lainnya":
    default:
      return "lainnya";
  }
}

/**
 * Mirrors Prisma's `AccountType` enum — used for the "Dana & Rekening"
 * cash-like accounts shown alongside physical assets/investments on /aset.
 * `investment` here means a brokerage CASH sub-account (not a holding), so
 * it buckets with everyday liquid funds, not `saham`.
 */
export function accountTypeToAssetClass(type: string): AssetClassKey {
  switch (type) {
    case "property":
      return "properti";
    case "bank":
    case "ewallet":
    case "cash":
    case "investment":
    default:
      return "kas_tabungan";
  }
}

/**
 * `InheritanceAsset.assetType` is a free-text string (never a DB enum), so
 * there is nothing to migrate — this mapper only normalizes DISPLAY. Known
 * legacy option strings (`warisan/page.tsx`'s historical `ASSET_TYPE_OPTIONS`)
 * map exactly; anything else (a typo, a pre-taxonomy custom entry) falls
 * back to "lainnya" rather than crashing or showing a blank category.
 */
export function warisanAssetTypeToAssetClass(assetType: string): AssetClassKey {
  const normalized = assetType.trim().toLowerCase();
  switch (normalized) {
    case "aset / properti":
    case "properti":
      return "properti";
    case "cash / tunai":
    case "kas & tabungan":
      return "kas_tabungan";
    case "surat berharga":
    case "obligasi/sbn":
    case "obligasi":
      return "obligasi";
    case "saham":
      return "saham";
    case "reksa dana":
      return "reksa_dana";
    case "kripto":
      return "kripto";
    case "deposito":
      return "deposito";
    case "kendaraan":
      return "kendaraan";
    case "emas":
      return "emas";
    case "lainnya":
    default:
      return "lainnya";
  }
}
