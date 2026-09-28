import { AntamGoldPriceService } from "./antam-gold-price.service";

import type { AntamGoldPriceClient } from "./antam-gold-price.client";
import type { PrismaService } from "../prisma/prisma.service";

const T0 = Date.parse("2026-09-28T08:00:00.000Z");
const HOUR = 60 * 60 * 1000;

function build(opts: {
  cached?: { pricePerKgIdr: bigint; fetchedAt: Date } | null;
  fetch?: jest.Mock;
  now?: () => number;
}) {
  const prisma = {
    goldMarketPrice: {
      findUnique: jest.fn().mockResolvedValue(opts.cached ?? null),
      upsert: jest.fn().mockResolvedValue({}),
    },
  };
  const client = {
    fetchPricePerKg: opts.fetch ?? jest.fn().mockResolvedValue(2_537_600_000n),
  };
  const service = new AntamGoldPriceService(
    prisma as unknown as PrismaService,
    client as unknown as AntamGoldPriceClient,
    opts.now ?? (() => T0),
  );
  return { service, prisma, client };
}

describe("AntamGoldPriceService", () => {
  it("fetches live and caches when nothing is stored yet", async () => {
    const { service, prisma, client } = build({ cached: null });

    const snapshot = await service.getSnapshot();

    expect(client.fetchPricePerKg).toHaveBeenCalledTimes(1);
    expect(snapshot).toEqual({
      pricePerKgIdr: "2537600000",
      source: "emasantam",
      fetchedAt: new Date(T0).toISOString(),
      stale: false,
    });
    expect(prisma.goldMarketPrice.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { source: "emasantam" },
        create: expect.objectContaining({
          source: "emasantam",
          pricePerKgIdr: 2_537_600_000n,
        }),
      }),
    );
  });

  it("serves the cached value without a live fetch when it is fresh (< 6h)", async () => {
    const { service, client } = build({
      cached: {
        pricePerKgIdr: 2_500_000_000n,
        fetchedAt: new Date(T0 - 3 * HOUR),
      },
    });

    const snapshot = await service.getSnapshot();

    expect(client.fetchPricePerKg).not.toHaveBeenCalled();
    expect(snapshot).toEqual({
      pricePerKgIdr: "2500000000",
      source: "emasantam",
      fetchedAt: new Date(T0 - 3 * HOUR).toISOString(),
      stale: false,
    });
  });

  it("refetches when the cached value is 6h or older", async () => {
    const { service, client } = build({
      cached: {
        pricePerKgIdr: 2_500_000_000n,
        fetchedAt: new Date(T0 - 6 * HOUR),
      },
    });

    const snapshot = await service.getSnapshot();

    expect(client.fetchPricePerKg).toHaveBeenCalledTimes(1);
    expect(snapshot.pricePerKgIdr).toBe("2537600000");
    expect(snapshot.stale).toBe(false);
  });

  it("falls back to the last cached value (marked stale) when the live fetch fails", async () => {
    const { service } = build({
      cached: {
        pricePerKgIdr: 2_500_000_000n,
        fetchedAt: new Date(T0 - 7 * HOUR),
      },
      fetch: jest.fn().mockRejectedValue(new Error("network down")),
    });

    const snapshot = await service.getSnapshot();

    expect(snapshot).toEqual({
      pricePerKgIdr: "2500000000",
      source: "emasantam",
      fetchedAt: new Date(T0 - 7 * HOUR).toISOString(),
      stale: true,
    });
  });

  it("falls back to the last cached value (marked stale) when the fetch succeeds but parsing returns null", async () => {
    const { service } = build({
      cached: {
        pricePerKgIdr: 2_500_000_000n,
        fetchedAt: new Date(T0 - 7 * HOUR),
      },
      fetch: jest.fn().mockResolvedValue(null),
    });

    const snapshot = await service.getSnapshot();

    expect(snapshot.stale).toBe(true);
    expect(snapshot.pricePerKgIdr).toBe("2500000000");
  });

  it("returns an all-null snapshot (never fabricates) when nothing has ever been cached and the live fetch fails", async () => {
    const { service } = build({
      cached: null,
      fetch: jest.fn().mockRejectedValue(new Error("network down")),
    });

    const snapshot = await service.getSnapshot();

    expect(snapshot).toEqual({
      pricePerKgIdr: null,
      source: null,
      fetchedAt: null,
      stale: false,
    });
  });

  it("does not throw when the Prisma cache read itself fails — falls through to a live fetch", async () => {
    const { service, prisma } = build({ cached: null });
    prisma.goldMarketPrice.findUnique.mockRejectedValue(new Error("db down"));

    await expect(service.getSnapshot()).resolves.toEqual(
      expect.objectContaining({ pricePerKgIdr: "2537600000", stale: false }),
    );
  });
});
