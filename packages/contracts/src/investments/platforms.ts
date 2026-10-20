/**
 * Investasi R3 — platform catalog. A code constant (not a table) so it ships
 * with the app and is reviewed like code. A user's account at a platform is a
 * `PlatformAccount` row referencing `key`; anything missing uses "custom".
 *
 * Honesty rules:
 * - `syncMode` is "manual" for every entry: WealthMe has NO integration with
 *   any platform. A logo/mark is not a claim of integration.
 * - `products` lists only what the platform's official site (or, where the
 *   site could not be read, its own announcements) showed on 2026-10-19.
 *   When a product could not be confirmed it is left out — the user can still
 *   record it under a "custom" platform. Re-verify before widening a list.
 * - `pockets` lists the cash pockets a user is likely to keep there; "general"
 *   is the fallback when the platform's cash model was not confirmed.
 * - `fractionalUsShares` is true only where the platform states fractional
 *   US shares.
 */

export const INVESTMENT_PRODUCT_KEYS = [
  "saham_idx",
  "saham_us",
  "reksa_dana",
  "obligasi",
  "emas",
  "kripto",
  "deposito",
] as const;
export type InvestmentProduct = (typeof INVESTMENT_PRODUCT_KEYS)[number];

/** Mirrors the Prisma enum `PocketKind`. */
export const POCKET_KINDS = ["rdn", "crypto", "usd", "general"] as const;
export type PocketKind = (typeof POCKET_KINDS)[number];

/** Mirrors the Prisma enum `PlatformSyncMode`. */
export type PlatformSyncMode = "manual";

export interface InvestmentPlatform {
  key: string;
  name: string;
  /** ISO 3166-1 alpha-2 of the operating entity. */
  country: string;
  /** Brand-neutral tint for the monogram chip (not a logo). */
  color: string;
  /** 1–2 letter monogram shown instead of a logo. */
  mark: string;
  products: readonly InvestmentProduct[];
  pockets: readonly PocketKind[];
  fractionalUsShares: boolean;
  syncMode: PlatformSyncMode;
  /** Where the product list was checked; null for "custom". */
  source: string | null;
}

export const CUSTOM_PLATFORM_KEY = "custom";

export const INVESTMENT_PLATFORMS: readonly InvestmentPlatform[] = [
  {
    key: "ajaib",
    name: "Ajaib",
    country: "ID",
    color: "#1E5EFF",
    mark: "Aj",
    // Saham, reksa dana and saham AS (via Ajaib Alpha, Feb 2025) per
    // ajaib.co.id, plus kripto: Ajaib Kripto is a separate app under the
    // same brand and login, and users record it as "Ajaib" (client report
    // 2026-10-21: "ajaib tidak bisa nambah wallet crypto"). Its IDR crypto
    // balance is a "crypto" pocket. Obligasi could not be verified, so it is
    // left out. Fractional US shares not confirmed.
    products: ["saham_idx", "saham_us", "reksa_dana", "kripto"],
    pockets: ["rdn", "crypto", "general"],
    fractionalUsShares: false,
    syncMode: "manual",
    source: "https://ajaib.co.id",
  },
  {
    key: "stockbit",
    name: "Stockbit Sekuritas",
    country: "ID",
    color: "#00AB6B",
    mark: "Sb",
    // Only Indonesian equities confirmed (stockbit.com could not be read).
    products: ["saham_idx"],
    pockets: ["rdn"],
    fractionalUsShares: false,
    syncMode: "manual",
    source: "https://stockbit.com",
  },
  {
    key: "ipot",
    name: "IPOT (Indo Premier Sekuritas)",
    country: "ID",
    color: "#E31E24",
    mark: "IP",
    // Saham/ETF, reksa dana (IPOT Fund) and obligasi (IPOT Bond). US shares
    // and gold were not confirmed.
    products: ["saham_idx", "reksa_dana", "obligasi"],
    pockets: ["rdn"],
    fractionalUsShares: false,
    syncMode: "manual",
    source: "https://www.indopremier.com",
  },
  {
    key: "bibit",
    name: "Bibit",
    country: "ID",
    color: "#00A85A",
    mark: "Bi",
    // bibit.id: reksa dana, SBN ritel, obligasi FR, saham.
    products: ["saham_idx", "reksa_dana", "obligasi"],
    pockets: ["rdn", "general"],
    fractionalUsShares: false,
    syncMode: "manual",
    source: "https://bibit.id",
  },
  {
    key: "bareksa",
    name: "Bareksa",
    country: "ID",
    color: "#0F9D58",
    mark: "Bk",
    // bareksa.com (re-checked 2026-10-19): Saham, Reksa Dana, SBN, Emas.
    products: ["saham_idx", "reksa_dana", "obligasi", "emas"],
    pockets: ["general"],
    fractionalUsShares: false,
    syncMode: "manual",
    source: "https://www.bareksa.com",
  },
  {
    key: "gotrade",
    name: "Gotrade",
    country: "ID",
    color: "#111827",
    mark: "Gt",
    // heygotrade.com/id: 600+ US stocks and ETFs, fractional from $1.
    products: ["saham_us"],
    pockets: ["usd"],
    fractionalUsShares: true,
    syncMode: "manual",
    source: "https://www.heygotrade.com/id",
  },
  {
    key: "pluang",
    name: "Pluang",
    country: "ID",
    color: "#2F54EB",
    mark: "Pl",
    // pluang.com: saham ID, fractional saham AS, kripto, reksa dana, emas.
    // A platform that sells kripto must offer a crypto pocket too, or the
    // user can't keep a "Dana Kripto" wallet there.
    products: ["saham_idx", "saham_us", "reksa_dana", "emas", "kripto"],
    pockets: ["general", "crypto"],
    fractionalUsShares: true,
    syncMode: "manual",
    source: "https://pluang.com",
  },
  {
    key: "pintu",
    name: "Pintu",
    country: "ID",
    color: "#0A68F4",
    mark: "Pi",
    // pintu.co.id: crypto only.
    products: ["kripto"],
    pockets: ["crypto"],
    fractionalUsShares: false,
    syncMode: "manual",
    source: "https://pintu.co.id",
  },
  {
    key: "indodax",
    name: "Indodax",
    country: "ID",
    color: "#1B3B6F",
    mark: "Id",
    products: ["kripto"],
    pockets: ["crypto"],
    fractionalUsShares: false,
    syncMode: "manual",
    source: "https://indodax.com",
  },
  {
    key: "tokocrypto",
    name: "Tokocrypto",
    country: "ID",
    color: "#0B1E3F",
    mark: "Tk",
    // tokocrypto.com: crypto only.
    products: ["kripto"],
    pockets: ["crypto"],
    fractionalUsShares: false,
    syncMode: "manual",
    source: "https://www.tokocrypto.com",
  },
  {
    key: "pegadaian",
    name: "Pegadaian",
    country: "ID",
    color: "#00753A",
    mark: "Pg",
    // pegadaian.co.id: Tabungan Emas, Cicil Emas.
    products: ["emas"],
    pockets: ["general"],
    fractionalUsShares: false,
    syncMode: "manual",
    source: "https://www.pegadaian.co.id",
  },
  {
    key: CUSTOM_PLATFORM_KEY,
    name: "Platform lain",
    country: "ID",
    color: "#64748B",
    mark: "+",
    // A user-named platform may hold anything; the user is the source.
    products: INVESTMENT_PRODUCT_KEYS,
    pockets: POCKET_KINDS,
    fractionalUsShares: true,
    syncMode: "manual",
    source: null,
  },
];

/** Catalog lookup; undefined for an unknown key (treat as custom). */
export function findInvestmentPlatform(
  key: string,
): InvestmentPlatform | undefined {
  return INVESTMENT_PLATFORMS.find((p) => p.key === key);
}
