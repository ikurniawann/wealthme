import { z } from "zod";

/**
 * Aset fields (2026-10-20) — structured specifications per physical-asset
 * category, stored in `Asset.details` (JSONB). Every field is optional; an
 * empty string counts as absent. Unknown keys are rejected so a spec typed
 * for one category never lands silently on another. Decimals and years are
 * strings (no float rounding); dates are calendar dates (yyyy-mm-dd).
 */

/** Mirrors Prisma's `AssetType` enum (apps/api/prisma/schema.prisma). */
export const ASSET_TYPE_IDS = [
  "properti",
  "kendaraan",
  "elektronik",
  "perhiasan",
  "emas",
  "seni_koleksi",
  "lainnya",
] as const;

export const ASSET_CERTIFICATE_TYPES = [
  "SHM",
  "HGB",
  "SHMSRS",
  "Girik-AJB",
  "Lainnya",
] as const;
export type AssetCertificateType = (typeof ASSET_CERTIFICATE_TYPES)[number];

/** Where the opening valuation of a new asset came from. */
export const ASSET_CREATE_VALUATION_SOURCES = [
  "manual",
  "appraisal",
  "market",
] as const;
export type AssetCreateValuationSource =
  (typeof ASSET_CREATE_VALUATION_SOURCES)[number];

const TEXT_MAX = 120;
const LONG_TEXT_MAX = 300;
const AREA_RE = /^\d{1,9}(\.\d{1,2})?$/;
const YEAR_RE = /^\d{4}$/;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRealYmd(v: string): boolean {
  if (!YMD_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Trims strings; "" (or whitespace) becomes undefined. */
function optional<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((v) => {
    if (typeof v !== "string") return v;
    const s = v.trim();
    return s === "" ? undefined : s;
  }, schema.optional());
}

const text = (max = TEXT_MAX) => optional(z.string().max(max));
const area = () =>
  optional(z.string().regex(AREA_RE, "Luas harus angka, maks. 2 desimal"));
const year = () =>
  optional(
    z
      .string()
      .regex(YEAR_RE, "Tahun harus 4 angka")
      .refine(
        (v) => Number(v) >= 1000 && Number(v) <= 2200,
        "Tahun tidak valid",
      ),
  );
const ymd = () =>
  optional(z.string().refine(isRealYmd, "Tanggal harus yyyy-mm-dd"));

export const AssetDetailsSchemas = {
  properti: z
    .object({
      landAreaM2: area(),
      buildingAreaM2: area(),
      certificateType: optional(z.enum(ASSET_CERTIFICATE_TYPES)),
      address: text(LONG_TEXT_MAX),
    })
    .strict(),
  kendaraan: z
    .object({
      brandModel: text(),
      year: year(),
      plateNumber: text(20),
    })
    .strict(),
  emas: z
    .object({
      purity: text(40),
      issuer: text(),
      serial: text(),
    })
    .strict(),
  perhiasan: z
    .object({
      material: text(),
      stones: text(),
      serial: text(),
    })
    .strict(),
  elektronik: z
    .object({
      brandModel: text(),
      serial: text(),
      warrantyUntil: ymd(),
    })
    .strict(),
  seni_koleksi: z
    .object({
      artistMaker: text(),
      year: year(),
      provenance: text(LONG_TEXT_MAX),
    })
    .strict(),
  lainnya: z.object({}).strict(),
} as const satisfies Record<(typeof ASSET_TYPE_IDS)[number], z.ZodTypeAny>;

export type AssetDetailsByType = {
  [K in keyof typeof AssetDetailsSchemas]: z.infer<
    (typeof AssetDetailsSchemas)[K]
  >;
};
export type AssetDetails = AssetDetailsByType[keyof AssetDetailsByType];
/** Every spec key of every category (display order is per category). */
export type AssetDetailKey = {
  [K in keyof AssetDetailsByType]: keyof AssetDetailsByType[K];
}[keyof AssetDetailsByType] &
  string;

export type ParseAssetDetailsResult =
  | { ok: true; details: Record<string, string> | null }
  | { ok: false; field: string; message: string };

/**
 * Validates `input` against the category's schema. All-empty → null (no
 * specs). An unknown category has no specs: anything but empty is refused.
 */
export function parseAssetDetails(
  type: string,
  input: unknown,
): ParseAssetDetailsResult {
  if (input === null || input === undefined) return { ok: true, details: null };
  const schema = (AssetDetailsSchemas as Record<string, z.ZodTypeAny>)[type];
  if (!schema) {
    return { ok: false, field: "details", message: "Kategori tidak dikenal" };
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const key = issue?.path[0];
    const unknown =
      issue?.code === "unrecognized_keys" ? issue.keys[0] : undefined;
    return {
      ok: false,
      field: `details.${String(unknown ?? key ?? "")}`.replace(/\.$/, ""),
      message:
        issue?.code === "unrecognized_keys"
          ? `Spesifikasi "${String(unknown)}" tidak berlaku untuk kategori ini`
          : (issue?.message ?? "Spesifikasi tidak valid"),
    };
  }
  const clean = Object.fromEntries(
    Object.entries(parsed.data as Record<string, unknown>).filter(
      (e): e is [string, string] => typeof e[1] === "string",
    ),
  );
  return {
    ok: true,
    details: Object.keys(clean).length > 0 ? clean : null,
  };
}
