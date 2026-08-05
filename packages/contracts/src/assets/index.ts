// Mirrors Prisma's `AssetType` enum (apps/api/prisma/schema.prisma). Kept as
// a plain union here rather than importing the Prisma enum so this package
// stays framework-agnostic; AssetDto.type itself stays a plain `string` for
// backward compatibility with existing consumers.
export type AssetTypeId =
  | "properti"
  | "kendaraan"
  | "elektronik"
  | "perhiasan"
  | "lainnya";

export interface AssetDto {
  id: string;
  familyGroupId: string;
  name: string;
  type: string;
  currentValue: string;
  currency: string;
  notes: string | null;
  // EPIC-021 #17/#18: signed annual value-change rate (%), negative =
  // depreciation, positive = appreciation. Null = no rate set.
  valueChangeRatePct: string | null;
  // EPIC-021 #16: optional physical-asset category from master data (the
  // Category model, same family group). Null = no category set.
  categoryId: string | null;
  // EPIC-023 D19/US-ASSET-4: date the asset was acquired (ISO string). Null
  // when not set, in which case createdAt is used as the elapsed-time
  // anchor for currentEstimatedValue below.
  acquisitionDate: string | null;
  // Compute-on-read pro-rata estimate of currentValue given
  // valueChangeRatePct and elapsed time since acquisitionDate (or createdAt
  // when acquisitionDate is null). Equals currentValue when
  // valueChangeRatePct is null or zero. THIS IS A PROJECTION, NOT NET
  // WORTH — currentValue is authoritative for net worth (EPIC-023 D19);
  // consumers must not sum this field into a totals display.
  currentEstimatedValue: string;
  createdAt: string;
  updatedAt: string;
}

// EPIC-023 D19/US-ASSET-4: canonical per-asset-type default annual
// value-change rate (%), used only as a frontend pre-fill suggestion for
// AddAssetModal's rate field — never applied by the backend. Applying it
// server-side when valueChangeRatePct is null would silently change the
// computed estimate for every existing rate-less asset, the exact class of
// surprise this task exists to prevent (see aset/page.tsx AddAssetModal).
export const DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT: Record<AssetTypeId, number> =
  {
    properti: 3, // modest appreciation
    kendaraan: -12, // typical vehicle depreciation
    elektronik: -20, // fast depreciation
    perhiasan: 2, // mild appreciation
    lainnya: 0, // no assumption
  };

export interface AssetHistoryDto {
  id: string;
  assetId: string;
  value: string;
  recordedAt: string;
}

export interface CreateAssetDto {
  name: string;
  type: string;
  currentValue: string;
  currency?: string;
  notes?: string;
  valueChangeRatePct?: string;
  categoryId?: string;
  // EPIC-023 D19/US-ASSET-4: ISO date string. Falls back to createdAt when
  // omitted.
  acquisitionDate?: string;
}

export interface UpdateAssetDto {
  name?: string;
  type?: string;
  currentValue?: string;
  currency?: string;
  notes?: string;
  valueChangeRatePct?: string;
  categoryId?: string;
  acquisitionDate?: string;
}
