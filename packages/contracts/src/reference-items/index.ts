import { z } from "zod";

/**
 * EPIC-024 Task J (D14, US-MD-1) — the seven reference lists (bank, e-wallet,
 * transaction type, investment type, donation institution, asset category,
 * insurance type) that used to be hardcoded arrays in `masterdata/page.tsx`
 * ("Master data is a client-side illusion" — Evidence section). This is the
 * single source of truth for the group ids and their seed defaults, shared
 * by the API (`auth.service.ts` registration, the web Better-Auth hook, and
 * the backfill migration comment) and the web `masterdata` page.
 *
 * "Kategori" is NOT part of this — it already has its own real API/table
 * (`Category`) and stays that way (see `categories/index.ts`).
 */
export const ReferenceItemGroupSchema = z.enum([
  "bank",
  "ewallet",
  "txntype",
  "invtype",
  "lembaga",
  "asettype",
  "instype",
]);
export type ReferenceItemGroup = z.infer<typeof ReferenceItemGroupSchema>;

export const CreateReferenceItemDtoSchema = z.object({
  group: ReferenceItemGroupSchema,
  label: z.string().min(1).max(100),
});
export type CreateReferenceItemDto = z.infer<
  typeof CreateReferenceItemDtoSchema
>;

export const ReferenceItemDtoSchema = z.object({
  id: z.string().uuid(),
  familyGroupId: z.string().uuid(),
  group: ReferenceItemGroupSchema,
  label: z.string(),
  sortOrder: z.number().int(),
  isSystem: z.boolean(),
  createdAt: z.string(),
});
export type ReferenceItemDto = z.infer<typeof ReferenceItemDtoSchema>;

/**
 * Seed defaults per group, in display order — ported verbatim from the old
 * `REFERENCE_GROUPS` local array (`masterdata/page.tsx`). `sortOrder` is the
 * array index, so seeded rows keep the same order the demo always showed.
 */
export const REFERENCE_ITEM_DEFAULTS: Record<
  ReferenceItemGroup,
  readonly string[]
> = {
  bank: ["BCA", "Mandiri", "BNI", "BRI", "CIMB Niaga", "Permata"],
  txntype: ["Pemasukan", "Pengeluaran", "Transfer", "Kartu Kredit"],
  invtype: ["Saham", "Reksa Dana", "Obligasi", "Emas", "Crypto"],
  ewallet: ["GoPay", "OVO", "DANA", "LinkAja", "ShopeePay"],
  lembaga: ["BAZNAS", "Dompet Dhuafa", "Gereja / Paroki", "Pura / Vihara"],
  asettype: ["Properti", "Kendaraan", "Elektronik", "Perhiasan"],
  instype: ["Jiwa", "Kesehatan", "Kendaraan", "Properti"],
};

export type ReferenceItemSeedEntry = {
  group: ReferenceItemGroup;
  label: string;
  sortOrder: number;
};

/**
 * Flattened seed rows in `(familyGroupId, group, label, sortOrder, isSystem: true)`
 * shape, for `createMany` at registration. Kept as a function (not a static
 * array) purely for a fresh `sortOrder` sequence per group — the content is
 * static.
 */
export function buildReferenceItemSeed(): ReferenceItemSeedEntry[] {
  return ReferenceItemGroupSchema.options.flatMap((group) =>
    REFERENCE_ITEM_DEFAULTS[group].map((label, index) => ({
      group,
      label,
      sortOrder: index,
    })),
  );
}
