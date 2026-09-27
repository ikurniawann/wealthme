const MAX_TICKER_LENGTH = 20;
const SUFFIX_LENGTH = 4;

/**
 * E2E round-2 B1 — manual-only instrument types (deposito, emas, reksa
 * dana, obligasi, lainnya) have no real market ticker; Indonesian users
 * have no ticker for a deposito at BRI or emas Antam fisik. This derives a
 * stable internal code purely to satisfy the NOT NULL `Investment.ticker`
 * column — it is never fed to MarketDataPort (see AUTOMATED_PRICE_TYPES in
 * market-data.port.ts) and must never be displayed to the user as if it
 * were a real ticker. Slugged from the instrument name, uppercased,
 * alnum/._- only (same charset the DTO's own ticker Matches() enforces),
 * with a short random suffix so two holdings named identically don't
 * collide — the column carries no unique constraint today, but the suffix
 * keeps derived codes distinct regardless.
 */
export function deriveInternalCode(name: string): string {
  const slug = name
    .toUpperCase()
    .replace(/[^A-Z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = Math.random()
    .toString(36)
    .slice(2, 2 + SUFFIX_LENGTH)
    .toUpperCase();
  const base = (slug || "INV").slice(0, MAX_TICKER_LENGTH - 1 - suffix.length);
  return `${base}-${suffix}`;
}
