/**
 * Aset fields (2026-10-20) — Pemilik on create (A7 row scope), Harga
 * perolehan as the opening transaction's cost basis, valuation date/source
 * on the opening valuation, per-category `details`, and seni_koleksi.
 */
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { AssetType, Prisma } from "@prisma/client";
import {
  DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT,
  parseAssetDetails,
} from "@wealthme/contracts";

import { detailsForUpdate, planOpening } from "./asset-create";
import {
  BASE,
  FG,
  TODAY,
  assetRow,
  kid,
  master,
} from "./asset-create.fixtures";
import { AssetsService } from "./assets.service";

import type { AssetValuationsService } from "./ledger/asset-valuations.service";
import type { PrismaService } from "../prisma/prisma.service";

function makeService(memberOf: string[] = []) {
  const tx = {
    asset: {
      create: jest.fn(({ data }) => Promise.resolve(assetRow(data))),
    },
    assetHistory: { create: jest.fn(() => Promise.resolve({})) },
  };
  const prisma = {
    member: {
      findUnique: jest.fn(({ where }) =>
        Promise.resolve(
          memberOf.includes(where.userId_familyGroupId.userId) &&
            where.userId_familyGroupId.familyGroupId === FG
            ? { id: "m" }
            : null,
        ),
      ),
    },
    category: { findFirst: jest.fn() },
    $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
  };
  const service = new AssetsService(
    prisma as unknown as PrismaService,
    {} as AssetValuationsService,
  );
  return { service, prisma, tx };
}

describe("create — Pemilik (A7 owner scoping)", () => {
  it("a row-scoped member cannot create an asset for another member", async () => {
    const { service, tx } = makeService(["u-spouse"]);
    await expect(
      service.create(FG, { ...BASE, ownerUserId: "u-spouse" }, kid),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.create(FG, { ...BASE, ownerUserId: null }, kid),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.asset.create).not.toHaveBeenCalled();
  });

  it("a row-scoped member owns what she records (omitted or herself)", async () => {
    const { service, tx } = makeService();
    await service.create(FG, BASE, kid);
    await service.create(FG, { ...BASE, ownerUserId: "u-kid" }, kid);
    for (const call of tx.asset.create.mock.calls) {
      expect(call[0].data.ownerUserId).toBe("u-kid");
    }
  });

  it("a family-wide member may pick a member of this family, or Bersama", async () => {
    const { service, tx } = makeService(["u-spouse"]);
    const owned = await service.create(
      FG,
      { ...BASE, ownerUserId: "u-spouse" },
      master,
    );
    expect(owned.ownerUserId).toBe("u-spouse");
    const shared = await service.create(FG, BASE, master);
    expect(shared.ownerUserId).toBeNull();
    expect(tx.asset.create).toHaveBeenCalledTimes(2);
  });

  it("rejects an owner who is not a member of this family (cross-tenant id)", async () => {
    const { service, tx } = makeService(["u-spouse"]);
    await expect(
      service.create(FG, { ...BASE, ownerUserId: "u-stranger" }, master),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.asset.create).not.toHaveBeenCalled();
  });
});

describe("create — details per category", () => {
  it("stores validated specs and returns them", async () => {
    const { service, tx } = makeService();
    const res = await service.create(
      FG,
      {
        ...BASE,
        details: { landAreaM2: "500", certificateType: "SHM", address: " " },
      },
      master,
    );
    expect(tx.asset.create.mock.calls[0][0].data.details).toEqual({
      landAreaM2: "500",
      certificateType: "SHM",
    });
    expect(res.details).toEqual({ landAreaM2: "500", certificateType: "SHM" });
  });

  it("rejects a spec of another category and a bad format (400, nothing written)", async () => {
    const { service, tx } = makeService();
    await expect(
      service.create(FG, { ...BASE, details: { plateNumber: "B 1" } }, master),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(
        FG,
        { ...BASE, details: { certificateType: "X" } },
        master,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.asset.create).not.toHaveBeenCalled();
  });

  it.each([
    [
      "properti",
      {
        landAreaM2: "120.5",
        buildingAreaM2: "90",
        certificateType: "Girik-AJB",
      },
    ],
    [
      "kendaraan",
      {
        brandModel: "Mercedes-Benz S 450 L",
        year: "2024",
        plateNumber: "B 1 WM",
      },
    ],
    ["emas", { purity: "24K", issuer: "Antam", serial: "AB123" }],
    [
      "perhiasan",
      { material: "Emas putih 18K", stones: "Berlian", serial: "R-1" },
    ],
    [
      "elektronik",
      { brandModel: "MacBook Pro", serial: "C02", warrantyUntil: "2027-01-31" },
    ],
    [
      "seni_koleksi",
      { artistMaker: "Affandi", year: "1965", provenance: "Galeri X" },
    ],
  ])("accepts every %s field", (type, details) => {
    expect(parseAssetDetails(type, details)).toEqual({ ok: true, details });
  });

  it("rejects malformed values", () => {
    expect(parseAssetDetails("kendaraan", { year: "24" }).ok).toBe(false);
    expect(parseAssetDetails("properti", { landAreaM2: "1,5" }).ok).toBe(false);
    expect(
      parseAssetDetails("elektronik", { warrantyUntil: "2026-02-30" }).ok,
    ).toBe(false);
    expect(parseAssetDetails("lainnya", { serial: "x" }).ok).toBe(false);
  });

  it("edit: a type change keeps specs that still fit, clears the rest", () => {
    const existing = { type: "emas" as AssetType, details: { serial: "S1" } };
    expect(detailsForUpdate(existing, { type: "perhiasan" })).toEqual({
      serial: "S1",
    });
    expect(detailsForUpdate(existing, { type: "properti" })).toBe(
      Prisma.DbNull,
    );
    expect(detailsForUpdate(existing, {})).toBeUndefined();
    expect(detailsForUpdate(existing, { details: null })).toBe(Prisma.DbNull);
  });
});

describe("seni_koleksi", () => {
  it("is a Prisma AssetType with a 0% default projection like lainnya", () => {
    expect(Object.values(AssetType)).toContain("seni_koleksi");
    expect(DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT.seni_koleksi).toBe(
      DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT.lainnya,
    );
  });

  it("can be created", async () => {
    const { service } = makeService();
    const res = await service.create(
      FG,
      {
        ...BASE,
        type: "seni_koleksi" as AssetType,
        details: { artistMaker: "Affandi" },
      },
      master,
    );
    expect(res.type).toBe("seni_koleksi");
  });
});

describe("opening valuation date and source", () => {
  it("total without cost: one opening row, date-only on the given date, with its source", async () => {
    const { service, tx } = makeService();
    await service.create(
      FG,
      { ...BASE, valuationDate: "2026-10-01", valuationSource: "appraisal" },
      master,
    );
    const row = (tx.assetHistory.create.mock.calls[0] as unknown[])[0] as {
      data: Record<string, unknown>;
    };
    expect(row.data).toMatchObject({
      kind: "opening",
      source: "appraisal",
      hasTime: false,
      value: 5_000_000_000n,
    });
    expect((row.data.effectiveDate as Date).toISOString()).toBe(
      "2026-10-01T00:00:00.000Z",
    );
  });

  it("rejects a future date and a date before the acquisition", () => {
    expect(() => planOpening({ valuationDate: "2026-10-21" }, TODAY)).toThrow(
      BadRequestException,
    );
    expect(() =>
      planOpening(
        { valuationDate: "2026-01-01", acquisitionDate: "2026-02-01" },
        TODAY,
      ),
    ).toThrow(BadRequestException);
  });
});
