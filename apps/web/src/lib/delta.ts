/**
 * The ONE delta presentation rule (Beranda hero KPIs, Ringkasan hero,
 * Laporan "Dibanding bulan lalu"):
 *
 *  - the arrow glyph is the DIRECTION of the change (↑ rose, ↓ fell, → flat);
 *  - the colour (and the screen-reader text) is the VALENCE: whether that
 *    direction is good or bad for the user. Spending that fell is a ↓ in the
 *    "good" colour; income that fell is a ↓ in the "bad" colour.
 *
 * Pure and framework-free so every surface derives both from the same numbers.
 */

export type DeltaDirection = "up" | "down" | "flat";
export type DeltaTone = "good" | "bad" | "neutral";

/** Which way is better: income/savings want "higher", spending wants "lower". */
export type DeltaPolarity = "higher-better" | "lower-better";

export const DELTA_ARROW: Record<DeltaDirection, string> = {
  up: "↑",
  down: "↓",
  flat: "→",
};

/** Localised words for the screen-reader sentence (`i18n` `common.delta`). */
export interface DeltaLabels {
  up: string;
  down: string;
  flat: string;
  good: string;
  bad: string;
}

export interface DeltaInfo {
  dir: DeltaDirection;
  tone: DeltaTone;
  /** Signed percent change, e.g. -68.0 for a fall from 4,525,000 to 1,450,000. */
  pct: number;
}

/**
 * A change that rounds to 0 at the displayed precision is "flat" — no arrow
 * race, no valence. `decimals` is how many decimals the surface prints.
 */
export function deltaDirection(pct: number, decimals = 0): DeltaDirection {
  const scale = 10 ** decimals;
  const rounded = Math.round(pct * scale);
  if (rounded > 0) return "up";
  if (rounded < 0) return "down";
  return "flat";
}

/** Valence of a direction: expense falling is good, income falling is bad. */
export function deltaTone(
  dir: DeltaDirection,
  polarity: DeltaPolarity = "higher-better",
): DeltaTone {
  if (dir === "flat") return "neutral";
  const higherIsBetter = polarity === "higher-better";
  return (dir === "up") === higherIsBetter ? "good" : "bad";
}

/**
 * Percent change from `previous` to `current`, relative to |previous| so a
 * negative base (a deficit that shrank) still reads as an improvement.
 * `null` when there is no base to compare (previous = 0, or non-finite).
 */
export function percentChange(
  previous: number,
  current: number,
): number | null {
  if (!Number.isFinite(previous) || !Number.isFinite(current)) return null;
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** Direction + valence + percent for a previous → current move, or null with no base. */
export function describeDelta(
  previous: number,
  current: number,
  polarity: DeltaPolarity = "higher-better",
  decimals = 0,
): DeltaInfo | null {
  const pct = percentChange(previous, current);
  if (pct === null) return null;
  const dir = deltaDirection(pct, decimals);
  return { dir, tone: deltaTone(dir, polarity), pct };
}

/** "turun, baik" — the valence spoken aloud, since the arrow glyph is decorative. */
export function deltaSrText(
  dir: DeltaDirection,
  tone: DeltaTone,
  labels: DeltaLabels,
): string {
  const move = labels[dir];
  if (tone === "neutral") return move;
  return `${move}, ${labels[tone]}`;
}
