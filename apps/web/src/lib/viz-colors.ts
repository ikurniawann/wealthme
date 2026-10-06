/**
 * Categorical data-viz colors: one stable category → token assignment shared by
 * every page, so "saham" / "jiwa" / a spending slot look the same everywhere.
 *
 * Tokens `--viz-1`..`--viz-6` live in `globals.css` (forest, lime, sand, clay,
 * teal-forest, graphite) and are tuned to ≥3:1 on card surfaces in both themes.
 * They resolve live, so CSS `background`/`fill` can use the `var()` strings
 * directly; ApexCharts needs concrete values — use `chartPalette()` from
 * `@/components/charts/apex-base` there.
 */

const VIZ_COUNT = 6;

type VizSlot = 1 | 2 | 3 | 4 | 5 | 6;

function viz(slot: VizSlot): string {
  return `var(--viz-${slot})`;
}

/** Nth categorical color, wrapping after six. Use when the category has no fixed identity (spend rows, hashed names, balance groups). */
export function vizByIndex(index: number): string {
  const wrapped = ((Math.trunc(index) % VIZ_COUNT) + VIZ_COUNT) % VIZ_COUNT;
  return viz((wrapped + 1) as VizSlot);
}

/**
 * `color-mix` of a viz token into the card surface, for soft avatar / chip
 * backgrounds. Pair with `var(--wm-ink)` text, which flips with the theme.
 */
export function vizTint(index: number, percent = 24): string {
  return `color-mix(in srgb, ${vizByIndex(index)} ${percent}%, var(--wm-card))`;
}

/**
 * Pengeluaran, one tone on every screen: the surface's own strong ink,
 * softened toward its background (graphite on light cards, pale ink on the
 * forest hero / dark cards). Contrast of this mix: 7.2:1 on the white card,
 * 9.0:1 on the dark card, 6.5:1 on the forest hero (>=5.1:1 on its lightest
 * stop). `--cstrong`/`--cbg` are re-pointed by `.wm-dark`, so the same string
 * works for chart fills, legend swatches and text. Amber (`--viz-3`/warning) is
 * reserved for budget pressure and due dates, never for expense.
 */
export const EXPENSE_COLOR =
  "color-mix(in srgb, var(--cstrong) 72%, var(--cbg))";

/** Pemasukan on a light card: the deepened lime (`--viz-2`; lime on the dark hero by scope). */
export const INCOME_COLOR = viz(2);

// Seven investment types over six tokens: deposito shares obligasi's teal
// (both fixed income); "lainnya" is the neutral graphite.
const ASSET_CLASS_SLOT: Record<string, VizSlot> = {
  saham: 1,
  reksa_dana: 2,
  emas: 3,
  kripto: 4,
  obligasi: 5,
  deposito: 5,
  lainnya: 6,
};

/** Investment type (`saham`, `reksa_dana`, …) → categorical color. */
export function assetClassColor(type: string): string {
  return viz(ASSET_CLASS_SLOT[type] ?? 6);
}

const INSURANCE_TYPE_SLOT: Record<string, VizSlot> = {
  jiwa: 1,
  kesehatan: 2,
  kendaraan: 3,
  properti: 4,
  pendidikan: 5,
  lainnya: 6,
};

/** Insurance type (`jiwa`, `kesehatan`, …) → categorical color. */
export function insuranceTypeColor(type: string): string {
  return viz(INSURANCE_TYPE_SLOT[type] ?? 6);
}

const ASSET_GROUP_SLOT = {
  physical: 3,
  investment: 1,
  bank: 5,
  cash: 2,
} as const satisfies Record<string, VizSlot>;

/** Top-level asset composition groups on /aset. */
export function assetGroupColor(group: keyof typeof ASSET_GROUP_SLOT): string {
  return viz(ASSET_GROUP_SLOT[group]);
}

const ACCOUNT_TYPE_SLOT: Record<string, VizSlot> = {
  investment: 1,
  cash: 2,
  property: 3,
  ewallet: 4,
  bank: 5,
};

/**
 * Ringkasan composition: account type → the same hue the matching /aset group
 * uses (bank teal, cash lime, property sand, investment forest). Unknown types
 * take the next palette hue by rank instead of the API's free-form hex.
 */
export function accountTypeColor(type: string, rank: number): string {
  const slot = ACCOUNT_TYPE_SLOT[type];
  return slot ? viz(slot) : vizByIndex(rank);
}
