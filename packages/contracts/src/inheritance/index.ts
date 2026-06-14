export type InheritanceVisibility = "private" | "heirs_only" | "all_members";

export interface InheritanceHeirDto {
  id: string;
  inheritanceAssetId: string;
  name: string;
  relationship: string;
  sharePercent: string;
  createdAt: string;
}

export interface InheritanceAssetDto {
  id: string;
  familyGroupId: string;
  name: string;
  assetType: string;
  estimatedValue: string;
  currency: string;
  notes: string | null;
  visibility: InheritanceVisibility;
  documentUrl: string | null;
  heirs: InheritanceHeirDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateHeirDto {
  name: string;
  relationship: string;
  sharePercent: number;
}

export interface CreateInheritanceAssetDto {
  name: string;
  assetType: string;
  estimatedValue: number;
  currency?: string;
  notes?: string;
  visibility?: InheritanceVisibility;
  heirs?: CreateHeirDto[];
}

export interface UpdateInheritanceAssetDto {
  name?: string;
  assetType?: string;
  estimatedValue?: number;
  currency?: string;
  notes?: string;
  visibility?: InheritanceVisibility;
  heirs?: CreateHeirDto[];
}
