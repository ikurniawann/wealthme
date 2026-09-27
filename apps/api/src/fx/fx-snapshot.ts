import type { FxCurrencyCode } from "@wealthme/contracts";

export interface FxSnapshot {
  source: "frankfurter" | "indicative";
  rateDate: string;
  fetchedAt: string;
  stale: boolean;
  idrPerUnit: Record<FxCurrencyCode, string>;
}

/** Display-only floats in the legacy `/fx/rates` shape: 1 `base` expressed in each currency. */
export function ratesFromSnapshot(
  snapshot: FxSnapshot,
  base: string,
): Record<string, number> {
  const idr = snapshot.idrPerUnit as Record<string, string>;
  const baseIdr = Number(idr[base] ?? "1");
  return Object.fromEntries(
    Object.entries(idr).map(([code, perUnit]) => [
      code,
      baseIdr / Number(perUnit),
    ]),
  );
}
