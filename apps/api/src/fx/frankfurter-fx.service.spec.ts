import { Prisma } from "@prisma/client";

import { FrankfurterFxService } from "./frankfurter-fx.service";
import { FxMockService } from "./fx-mock.service";

import type { FrankfurterClient, ProviderRates } from "./frankfurter.client";
import type { PrismaService } from "../prisma/prisma.service";

const LIVE: ProviderRates = {
  rateDate: "2026-09-25",
  idrPerUnit: {
    IDR: "1.000000",
    EUR: "20427.220000",
    USD: "17913.899851",
    SGD: "14026.793930",
    JPY: "113.674012",
    AUD: "12593.847102",
    CNY: "2668.445873",
    GBP: "23724.274100",
    HKD: "2277.898551",
    MYR: "4101.851406",
    THB: "536.146194",
    PHP: "310.916590",
    KRW: "13.077705",
    INR: "213.674059",
  },
};
const T0 = Date.parse("2026-10-26T03:00:00.000Z");
const HOUR = 60 * 60 * 1000;

function storedRows(rateDate: string, fetchedAt: number) {
  return (
    [
      "USD",
      "SGD",
      "EUR",
      "JPY",
      "AUD",
      "CNY",
      "GBP",
      "HKD",
      "MYR",
      "THB",
      "PHP",
      "KRW",
      "INR",
    ] as const
  ).map((currency) => ({
    id: `r-${currency}`,
    source: "frankfurter",
    currency,
    rateDate: new Date(`${rateDate}T00:00:00.000Z`),
    idrPerUnit: new Prisma.Decimal(LIVE.idrPerUnit[currency]),
    fetchedAt: new Date(fetchedAt),
  }));
}

function build(opts: {
  rows?: ReturnType<typeof storedRows>;
  fetch?: jest.Mock;
  now?: () => number;
}) {
  const prisma = {
    fxRate: {
      findMany: jest.fn().mockResolvedValue(opts.rows ?? []),
      upsert: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const client = {
    fetchLatest: opts.fetch ?? jest.fn().mockResolvedValue(LIVE),
  };
  const service = new FrankfurterFxService(
    prisma as unknown as PrismaService,
    client as unknown as FrankfurterClient,
    new FxMockService(),
    opts.now ?? (() => T0),
  );
  return { service, prisma, client };
}

describe("FrankfurterFxService — revisi I", () => {
  it("serves the stored rows without calling the provider while they are < 12 h old", async () => {
    const { service, client } = build({
      rows: storedRows("2026-09-25", T0 - 2 * HOUR),
    });
    const snap = await service.getSnapshot();
    expect(client.fetchLatest).not.toHaveBeenCalled();
    expect(snap).toMatchObject({
      source: "frankfurter",
      rateDate: "2026-09-25",
      stale: false,
    });
    expect(snap.idrPerUnit.USD).toBe("17913.899851");
    expect(snap.idrPerUnit.IDR).toBe("1.000000");
  });

  it("fetches, persists and returns live rates when the store is empty", async () => {
    const { service, prisma, client } = build({});
    const snap = await service.getSnapshot();
    expect(client.fetchLatest).toHaveBeenCalledTimes(1);
    expect(prisma.fxRate.upsert).toHaveBeenCalledTimes(13);
    expect(prisma.fxRate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          source_currency_rateDate: {
            source: "frankfurter",
            currency: "USD",
            rateDate: new Date("2026-09-25T00:00:00.000Z"),
          },
        },
      }),
    );
    expect(snap).toMatchObject({
      source: "frankfurter",
      stale: false,
      rateDate: "2026-09-25",
    });
  });

  it("fetches when the stored rows are older than 12 h", async () => {
    const { service, client } = build({
      rows: storedRows("2026-09-24", T0 - 13 * HOUR),
    });
    const snap = await service.getSnapshot();
    expect(client.fetchLatest).toHaveBeenCalledTimes(1);
    expect(snap.rateDate).toBe("2026-09-25");
  });

  it("falls back to the latest stored rows when the provider fails", async () => {
    const { service } = build({
      rows: storedRows("2026-09-24", T0 - 30 * HOUR),
      fetch: jest.fn().mockRejectedValue(new Error("Frankfurter FX timed out")),
    });
    const snap = await service.getSnapshot();
    expect(snap).toMatchObject({
      source: "frankfurter",
      rateDate: "2026-09-24",
      stale: true,
    });
  });

  it("falls back to the indicative table when provider and DB are both empty", async () => {
    const { service } = build({
      fetch: jest.fn().mockRejectedValue(new Error("down")),
    });
    const snap = await service.getSnapshot();
    expect(snap).toMatchObject({ source: "indicative", stale: true });
    expect(snap.idrPerUnit.USD).toBe("15873.015873");
  });

  it("serves live rates when the fx_rates read fails", async () => {
    const { service, prisma, client } = build({});
    prisma.fxRate.findMany.mockRejectedValueOnce(new Error("db down"));
    const snap = await service.getSnapshot();
    expect(client.fetchLatest).toHaveBeenCalledTimes(1);
    expect(snap).toMatchObject({
      source: "frankfurter",
      stale: false,
      rateDate: "2026-09-25",
    });
  });

  it("falls back to the indicative table when both the fx_rates read and the provider fail", async () => {
    const { service, prisma } = build({
      fetch: jest.fn().mockRejectedValue(new Error("down")),
    });
    prisma.fxRate.findMany.mockRejectedValueOnce(new Error("db down"));
    expect(await service.getSnapshot()).toMatchObject({
      source: "indicative",
      stale: true,
    });
  });

  it("still returns live rates when persisting them fails", async () => {
    const { service, prisma } = build({});
    prisma.$transaction.mockRejectedValueOnce(new Error("db down"));
    const snap = await service.getSnapshot();
    expect(snap).toMatchObject({ source: "frankfurter", stale: false });
  });

  it("memoises a fresh snapshot for 60 min: no second DB or provider call", async () => {
    let now = T0;
    const { service, prisma, client } = build({ now: () => now });
    await service.getSnapshot();
    now += 59 * 60 * 1000;
    await service.getSnapshot();
    expect(prisma.fxRate.findMany).toHaveBeenCalledTimes(1);
    expect(client.fetchLatest).toHaveBeenCalledTimes(1);
  });

  it("memoises a stale snapshot for only 5 min so recovery is quick", async () => {
    let now = T0;
    const fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValue(LIVE);
    const { service } = build({ fetch, now: () => now });
    expect((await service.getSnapshot()).stale).toBe(true);
    now += 6 * 60 * 1000;
    expect((await service.getSnapshot()).stale).toBe(false);
  });

  it("single-flight: concurrent callers share one provider call", async () => {
    const { service, client } = build({});
    await Promise.all([
      service.getSnapshot(),
      service.getSnapshot(),
      service.getSnapshot(),
    ]);
    expect(client.fetchLatest).toHaveBeenCalledTimes(1);
  });

  it("getRates('IDR') keeps the legacy numeric shape (1 IDR in X)", async () => {
    const { service } = build({ rows: storedRows("2026-09-25", T0 - HOUR) });
    const rates = await service.getRates("IDR");
    expect(rates.IDR).toBe(1);
    expect(rates.USD).toBeCloseTo(1 / 17913.899851, 12);
    expect(await service.getRate("USD", "IDR")).toBeCloseTo(17913.899851, 6);
  });
});
