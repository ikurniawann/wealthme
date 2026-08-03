export type InheritanceVisibility = "private" | "heirs_only" | "all_members";

export interface InheritanceHeirDto {
  id: string;
  inheritanceAssetId: string;
  name: string;
  relationship: string;
  sharePercent: string;
  memberUserId: string | null;
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
  // EPIC-021 Group D (#11) — set when this record was created by picking an
  // existing Asset instead of manual entry; null for manual entries.
  assetId: string | null;
  heirs: InheritanceHeirDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateHeirDto {
  name: string;
  relationship: string;
  sharePercent: number;
  memberUserId?: string;
}

export interface CreateInheritanceAssetDto {
  name: string;
  assetType: string;
  estimatedValue: number;
  currency?: string;
  notes?: string;
  visibility?: InheritanceVisibility;
  assetId?: string;
  heirs?: CreateHeirDto[];
}

export interface UpdateInheritanceAssetDto {
  name?: string;
  assetType?: string;
  estimatedValue?: number;
  currency?: string;
  notes?: string;
  visibility?: InheritanceVisibility;
  // TS review fix #2 — explicit `null` clears a previously picked Asset link
  // (switching back to manual entry); omitting the field leaves it untouched.
  assetId?: string | null;
  heirs?: CreateHeirDto[];
}
