import type { FxRatesResponse } from "@wealthme/contracts";

/** ECB 2026-09-25 via Frankfurter, as served by GET /fx/rates?base=IDR (revisi I). */
export const TEST_FX_RATES: FxRatesResponse = {
  base: "IDR",
  rates: { IDR: 1, USD: 1 / 17913.899851, JPY: 1 / 113.674012 },
  rateDate: "2026-09-25",
  source: "frankfurter",
  stale: false,
  idrPerUnit: {
    IDR: "1.000000",
    USD: "17913.899851",
    SGD: "14026.793930",
    EUR: "20427.220000",
    JPY: "113.674012",
    AUD: "12593.847102",
    CNY: "2668.445873",
    GBP: "20712.500000",
    HKD: "2108.300000",
    MYR: "3712.450000",
    THB: "482.150000",
    PHP: "287.900000",
    KRW: "11.870000",
    INR: "195.400000",
  },
};
