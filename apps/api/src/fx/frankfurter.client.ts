import {
  deriveIdrPerUnit,
  formatScaled,
  FX_RATE_SCALE,
  parseScaled,
  type FxCurrencyCode,
} from "@wealthme/contracts";
import { z } from "zod";

import { fetchWithTimeout } from "../common/utils/external-fetch.util";

export const FRANKFURTER_SOURCE = "frankfurter";
const FRANKFURTER_URL =
  "https://api.frankfurter.dev/v1/latest?base=EUR&symbols=IDR,USD,SGD,JPY,AUD,CNY";
const FX_TIMEOUT_MS = 5_000;

const positiveRate = z.number().positive().finite();
const ResponseSchema = z.object({
  base: z.literal("EUR"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rates: z.object({
    IDR: positiveRate,
    USD: positiveRate,
    SGD: positiveRate,
    JPY: positiveRate,
    AUD: positiveRate,
    CNY: positiveRate,
  }),
});

export interface ProviderRates {
  rateDate: string;
  idrPerUnit: Record<FxCurrencyCode, string>;
}

type FetchWithTimeout = typeof fetchWithTimeout;

function toDecimal(n: number): string {
  const s = n.toFixed(FX_RATE_SCALE);
  parseScaled(s, FX_RATE_SCALE);
  return s;
}

export class FrankfurterClient {
  constructor(
    private readonly fetchImpl: FetchWithTimeout = fetchWithTimeout,
    private readonly timeoutMs: number = FX_TIMEOUT_MS,
  ) {}

  async fetchLatest(): Promise<ProviderRates> {
    const res = await this.fetchImpl(
      FRANKFURTER_URL,
      { headers: { accept: "application/json" } },
      this.timeoutMs,
      "Frankfurter FX",
    );
    if (!res.ok) throw new Error(`Frankfurter FX responded ${res.status}`);
    const body = ResponseSchema.parse(await res.json());
    const eurIdr = toDecimal(body.rates.IDR);
    const cross = (x: number) => deriveIdrPerUnit(eurIdr, toDecimal(x));
    return {
      rateDate: body.date,
      idrPerUnit: {
        IDR: formatScaled(10n ** BigInt(FX_RATE_SCALE), FX_RATE_SCALE),
        EUR: formatScaled(parseScaled(eurIdr, FX_RATE_SCALE), FX_RATE_SCALE),
        USD: cross(body.rates.USD),
        SGD: cross(body.rates.SGD),
        JPY: cross(body.rates.JPY),
        AUD: cross(body.rates.AUD),
        CNY: cross(body.rates.CNY),
      },
    };
  }
}
