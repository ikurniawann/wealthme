/** Shared fixtures for the asset-create specs (Aset fields, 2026-10-20). */
import { Prisma } from "@prisma/client";

import type { AssetViewer } from "./asset-access";
import type { Asset, AssetType } from "@prisma/client";

export const D = Prisma.Decimal;
export const FG = "fg-1";
export const TODAY = "2026-10-20";

export function assetRow(over: Partial<Asset> = {}): Asset {
  return {
    id: "a-1",
    familyGroupId: FG,
    name: "Rumah",
    type: "properti",
    currentValue: 5_000_000_000n,
    currency: "IDR",
    notes: null,
    investmentId: null,
    ownerUserId: null,
    quantity: null,
    unit: null,
    valuationModel: "total",
    costBasisPerUnit: null,
    internalCode: null,
    custodian: null,
    details: null,
    status: "active",
    soldAt: null,
    valueChangeRatePct: null,
    valueChangeMode: "percent",
    valueChangeAmount: null,
    acquisitionDate: null,
    categoryId: null,
    createdAt: new Date("2026-10-20T03:00:00Z"),
    updatedAt: new Date("2026-10-20T03:00:00Z"),
    ...over,
  } as Asset;
}

export const BASE = {
  name: "Rumah",
  type: "properti" as AssetType,
  currentValue: "5000000000",
};
export const kid: AssetViewer = {
  member: { role: "dependant", rowScoped: true } as AssetViewer["member"],
  userId: "u-kid",
};
export const master: AssetViewer = {
  member: { role: "owner", rowScoped: false } as AssetViewer["member"],
  userId: "u-master",
};
