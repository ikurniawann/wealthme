import { useLocale } from "@/hooks/use-locale";
import type { ReportRangePreset } from "@/lib/laporan-period";
import type { I18nDictionary } from "@/i18n";

/**
 * EPIC-023 Task B (B1, US-RPT-12) — date-range presets, applied across every
 * /laporan sub-view. Selecting a preset other than "Custom" overrides the
 * year/month/day `PeriodFilter` above; picking "Custom" hands control back
 * to it (see `LaporanInner`'s `rangeStart`/`rangeEnd` derivation).
 */
// Bento v2: the prototype's six options (docs/design/proto/laporan.html PRESETS).
const RANGE_PRESET_IDS: ReportRangePreset[] = [
  "thisMonth",
  "last3Months",
  "last6Months",
  "last12Months",
  "thisYear",
  "custom",
];

/** Shared preset → label map (EPIC-023 Task B retry, MEDIUM — this used to
 * be duplicated verbatim in `RangePresetSelect` and in `LaporanInner`'s
 * `periodLabel` derivation; one source now feeds both). */
export function buildRangePresetLabels(
  t: I18nDictionary,
): Record<ReportRangePreset, string> {
  return {
    thisMonth: t.laporan.periodFilter.presetThisMonth,
    lastMonth: t.laporan.periodFilter.presetLastMonth,
    last3Months: t.laporan.periodFilter.presetLast3Months,
    last6Months: t.laporan.periodFilter.presetLast6Months,
    last12Months: t.laporan.periodFilter.presetLast12Months,
    thisYear: t.laporan.periodFilter.presetThisYear,
    lastYear: t.laporan.periodFilter.presetLastYear,
    custom: t.laporan.periodFilter.presetCustom,
  };
}

export function RangePresetSelect({
  preset,
  onChange,
}: {
  preset: ReportRangePreset;
  onChange: (next: ReportRangePreset) => void;
}) {
  const { t } = useLocale();
  const labels = buildRangePresetLabels(t);

  return (
    <select
      aria-label={t.laporan.periodFilter.presetAriaLabel}
      value={preset}
      onChange={(e) => onChange(e.target.value as ReportRangePreset)}
      className="select w-full"
    >
      {RANGE_PRESET_IDS.map((id) => (
        <option key={id} value={id}>
          {labels[id]}
        </option>
      ))}
    </select>
  );
}
