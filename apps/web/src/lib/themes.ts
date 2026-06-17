/**
 * Theme preset registry for WealthMe.
 *
 * Two orthogonal axes:
 *   - Mode   : `.dark` class on <html>  (managed by next-themes, unchanged)
 *   - Preset : `data-theme` attr on <html>  (managed by this module + no-flash script)
 *
 * The default preset (indigo) writes NO `data-theme` attribute so the existing
 * :root / .dark CSS values remain the byte-identical fallback.
 */

/** localStorage key used by both the no-flash script and the picker component. */
export const THEME_PRESET_STORAGE_KEY = "wealthme-theme-preset";

/** The default preset id — maps to existing :root / .dark vars; no data-theme written. */
export const DEFAULT_THEME_PRESET = "indigo" as const;

/** A single color-preset entry. */
export interface ThemePreset {
  /** Unique id — matches the CSS `data-theme="<id>"` value. */
  id: string;
  /** Human-readable label shown in the picker UI. */
  label: string;
  /** Light-mode primary hex — used as a visual swatch in the picker. */
  swatch: string;
}

/**
 * All supported presets.
 * "indigo" is the default: selecting it removes the `data-theme` attribute
 * so the existing :root / .dark blocks take full effect.
 */
export const THEME_PRESETS: readonly ThemePreset[] = [
  { id: "indigo", label: "Indigo", swatch: "#4f46e5" }, // default — no data-theme attr
  { id: "emerald", label: "Emerald", swatch: "#059669" },
  { id: "rose", label: "Rose", swatch: "#e11d48" },
  { id: "amber", label: "Amber", swatch: "#d97706" },
  { id: "violet", label: "Violet", swatch: "#7c3aed" },
  { id: "slate", label: "Slate", swatch: "#475569" },
];

/** Set of valid preset ids — used for fast membership checks. */
const VALID_PRESET_IDS: ReadonlySet<string> = new Set(
  THEME_PRESETS.map((p) => p.id),
);

/**
 * Returns true when `id` is a known preset id.
 * Accepts null / undefined safely (returns false).
 * Useful in the no-flash inline script (inlined copy) and picker components.
 */
export function isValidPreset(id: string | null | undefined): boolean {
  if (id == null) return false;
  return VALID_PRESET_IDS.has(id);
}
