import { z } from "zod";

import { FX_CURRENCY_CODES } from "./currencies.js";

export * from "./currencies.js";
export * from "./money.js";

export const FxCurrencyCodeSchema = z.enum(FX_CURRENCY_CODES);

/** One money field typed in a foreign currency; the server converts it and overwrites `field`. */
export const FxInputSchema = z.object({
  field: z.string().min(1).max(96),
  currency: FxCurrencyCodeSchema.exclude(["IDR"]),
  amount: z.string().regex(/^-?\d{1,13}(\.\d{1,2})?$/),
});
export type FxInput = z.infer<typeof FxInputSchema>;

export const FxRatesResponseSchema = z.object({
  base: z.string(),
  rates: z.record(z.number()),
  rateDate: z.string(),
  source: z.enum(["frankfurter", "indicative"]),
  stale: z.boolean(),
  idrPerUnit: z.record(z.string()),
});
export type FxRatesResponse = z.infer<typeof FxRatesResponseSchema>;
