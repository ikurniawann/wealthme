/**
 * Aset fields (2026-10-20) — Harga perolehan is the opening transaction's
 * cost basis; Nilai saat ini is a separate valuation row.
 */
import { replayLedger } from "../investments/ledger/replay";

import { planOpening, writeOpening } from "./asset-create";
import { D, TODAY, assetRow } from "./asset-create.fixtures";
import { walkTimeline } from "./ledger/asset-timeline";
import { writeOpeningOnCreate } from "./ledger/asset-transactions.service";

import type { AssetValuationsService } from "./ledger/asset-valuations.service";
import type { TxClient } from "../common/utils/serializable-retry.util";

jest.mock("./ledger/asset-transactions.service", () => ({
  writeOpeningOnCreate: jest.fn(),
}));

describe("acquisitionCost — opening transaction at cost, valuation at value", () => {
  const opened = assetRow({ id: "a-2", currentValue: 1n });
  beforeEach(() => {
    (writeOpeningOnCreate as jest.Mock).mockReset().mockResolvedValue(opened);
  });
  function tx() {
    return {
      asset: { findUniqueOrThrow: jest.fn().mockResolvedValue(opened) },
      assetHistory: { create: jest.fn() },
    } as unknown as TxClient;
  }

  it("per-unit: the opening is priced at cost, the valuation at value ÷ qty", async () => {
    const insert = jest.fn();
    const asset = assetRow({
      valuationModel: "per_unit",
      currentValue: 1_200_000_000n,
    });
    const plan = planOpening(
      {
        acquisitionCost: "900000000",
        acquisitionDate: "2024-03-01",
        valuationSource: "market",
      },
      TODAY,
    );
    await writeOpening(
      tx(),
      { insert } as unknown as AssetValuationsService,
      asset,
      "1000",
      plan,
      "u-master",
    );
    expect(writeOpeningOnCreate).toHaveBeenCalledWith(
      expect.anything(),
      asset,
      { quantity: "1000", valueIdr: 900_000_000n, effectiveDate: "2024-03-01" },
      "u-master",
    );
    const v = insert.mock.calls[0][2];
    expect(v.pricePerUnit.toString()).toBe("1200000");
    expect(v.amount).toBeNull();
    expect(v).toMatchObject({
      source: "market",
      effectiveYmd: TODAY,
      hasTime: false,
    });
  });

  it("total: cost becomes a 1-unit opening, the value a total valuation", async () => {
    const insert = jest.fn();
    const plan = planOpening(
      { acquisitionCost: "3500000000", valuationDate: "2026-10-01" },
      TODAY,
    );
    await writeOpening(
      tx(),
      { insert } as unknown as AssetValuationsService,
      assetRow(),
      null,
      plan,
      null,
    );
    expect((writeOpeningOnCreate as jest.Mock).mock.calls[0][2]).toEqual({
      quantity: "1",
      valueIdr: 3_500_000_000n,
      effectiveDate: "2026-10-01",
    });
    const v = insert.mock.calls[0][2];
    expect(v.amount.toString()).toBe("5000000000");
    expect(v.pricePerUnit).toBeNull();
  });

  it("per-unit without cost keeps the legacy rule (cost = value) and adds no extra row", async () => {
    const insert = jest.fn();
    const asset = assetRow({
      valuationModel: "per_unit",
      currentValue: 10_000_000n,
    });
    await writeOpening(
      tx(),
      { insert } as unknown as AssetValuationsService,
      asset,
      "10",
      planOpening({}, TODAY),
      null,
    );
    expect((writeOpeningOnCreate as jest.Mock).mock.calls[0][2].valueIdr).toBe(
      10_000_000n,
    );
    expect(insert).not.toHaveBeenCalled();
  });

  it("unrealised gain = current value − cost; the value is counted once", () => {
    // Ledger: opening 1000 g at Rp900.000/g (cost Rp900 jt).
    const t0 = new Date("2026-10-20T03:00:00Z");
    const replay = replayLedger([
      {
        id: "tx-open",
        effectiveDate: "2024-03-01",
        effectiveTime: null,
        createdAt: t0,
        kind: "opening",
        quantity: new D(1000),
        pricePerUnit: new D(900_000),
        grossAmount: new D(900_000_000),
        fee: new D(0),
        tax: new D(0),
        currency: "IDR",
        fxRate: null,
      },
    ]);
    const steps = new Map(
      replay.steps.map((s) => [
        s.id,
        { quantityAfter: s.quantityAfter, priceIdr: new D(900_000) },
      ]),
    );
    const day = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
    const timeline = walkTimeline(
      [
        {
          id: "h-open",
          kind: "opening",
          value: 0n,
          effectiveAt: day("2024-03-01"),
          effectiveDate: day("2024-03-01"),
          hasTime: false,
          createdAt: t0,
          pricePerUnit: new D(900_000),
          currency: "IDR",
          fxRate: null,
          assetTransactionId: "tx-open",
        },
        {
          id: "h-val",
          kind: "valuation",
          value: 0n,
          effectiveAt: day(TODAY),
          effectiveDate: day(TODAY),
          hasTime: false,
          createdAt: new Date(t0.getTime() + 1),
          pricePerUnit: new D(1_200_000),
          currency: "IDR",
          fxRate: null,
          assetTransactionId: null,
        },
      ],
      steps,
      null,
      true,
    );
    const cost = replay.avgCost.times(replay.quantity);
    expect(cost.toString()).toBe("900000000");
    expect(timeline.current).toBe(1_200_000_000n);
    expect(new D(timeline.current!.toString()).minus(cost).toString()).toBe(
      "300000000",
    );
  });
});
