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
  // Compute-on-read pro-rata estimate of currentValue given
  // valueChangeRatePct and elapsed time since createdAt. Equals
  // currentValue when valueChangeRatePct is null or zero.
  currentEstimatedValue: string;
  createdAt: string;
  updatedAt: string;
}

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
}

export interface UpdateAssetDto {
  name?: string;
  type?: string;
  currentValue?: string;
  currency?: string;
  notes?: string;
  valueChangeRatePct?: string;
  categoryId?: string;
}
