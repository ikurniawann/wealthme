// EPIC-025 N3-I1 — the old `Donut`/`DonutLegend` SVG components were
// removed once N3-G swapped their last two consumers (beranda, laporan)
// to `DonutChart` (apex-presets.tsx). This file is kept — at this same
// path — purely to hold `DonutSegment`, since every page and
// `apps/web/src/lib/laporan-utils.ts` (protected) import the type from
// here and must not need an import-path change.
export type DonutSegment = {
  label: string;
  value: number;
  color: string;
  sub?: string;
};
