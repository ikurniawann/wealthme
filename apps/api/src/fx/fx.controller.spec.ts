import { FxController } from "./fx.controller";

import type { FxPort } from "./fx.port";

describe("FxController — revisi I", () => {
  it("GET /fx/rates adds rateDate, source, stale and idrPerUnit without changing rates", async () => {
    const port = {
      getRates: jest.fn().mockResolvedValue({ IDR: 1, USD: 0.0000558 }),
      getSnapshot: jest.fn().mockResolvedValue({
        source: "frankfurter",
        rateDate: "2026-09-25",
        fetchedAt: "2026-09-26T03:00:00.000Z",
        stale: false,
        idrPerUnit: { IDR: "1.000000", USD: "17913.899851" },
      }),
    };
    const res = await new FxController(port as unknown as FxPort).getRates(
      "IDR",
    );
    expect(res).toEqual({
      base: "IDR",
      rates: { IDR: 1, USD: 0.0000558 },
      rateDate: "2026-09-25",
      source: "frankfurter",
      stale: false,
      idrPerUnit: { IDR: "1.000000", USD: "17913.899851" },
    });
  });
});
