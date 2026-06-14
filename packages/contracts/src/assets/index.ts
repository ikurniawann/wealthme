export interface AssetDto {
  id: string;
  familyGroupId: string;
  name: string;
  type: string;
  currentValue: string;
  currency: string;
  notes: string | null;
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
}

export interface UpdateAssetDto {
  name?: string;
  type?: string;
  currentValue?: string;
  currency?: string;
  notes?: string;
}
