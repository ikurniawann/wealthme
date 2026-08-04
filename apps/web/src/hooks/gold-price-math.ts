// EPIC-021 Group F (#6) — pure gold-equivalent math, split out of
// `use-gold-price.ts` so it can be unit-tested without pulling in the
// `useSession`/`better-auth` import chain (which needs a browser-ish jsdom +
// mocked auth-client to load under Jest). No live gold price feed exists or
// may be fabricated (Open Design Decision #6); this only ever divides by a
// manually-entered price, never invents one.

/** Convert an IDR amount to gold grams, or `null` when no price is set. */
export function toGoldGrams(
  valueInIdr: number,
  pricePerGram: number | null,
): number | null {
  if (pricePerGram === null || pricePerGram <= 0) return null;
  return valueInIdr / pricePerGram;
}
