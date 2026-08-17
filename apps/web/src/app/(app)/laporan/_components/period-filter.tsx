import { useLocale } from "@/hooks/use-locale";
import {
  clampDayToMonth,
  daysInMonth,
  type ReportPeriodSelection,
  type ReportRangePreset,
} from "@/lib/laporan-period";
import type { I18nDictionary } from "@/i18n";

/* ───────────────────────── Shared period filter ───────────────────────── */

/** Native-input year/month/day filter that drives every /laporan section. */
export function PeriodFilter({
  period,
  onChange,
}: {
  period: ReportPeriodSelection;
  onChange: (next: ReportPeriodSelection) => void;
}) {
  const { t } = useLocale();
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);
  const maxDay = daysInMonth(period.year, period.month);

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <select
        aria-label={t.laporan.periodFilter.yearAriaLabel}
        value={period.year}
        onChange={(e) => {
          const year = Number(e.target.value);
          const day = period.day
            ? clampDayToMonth(year, period.month, period.day)
            : null;
          onChange({ ...period, year, day });
        }}
        className="select w-full"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <select
        aria-label={t.laporan.periodFilter.monthAriaLabel}
        value={period.month}
        onChange={(e) => {
          const month = Number(e.target.value);
          const day = period.day
            ? clampDayToMonth(period.year, month, period.day)
            : null;
          onChange({ ...period, month, day });
        }}
        className="select w-full"
      >
        {t.laporan.months.map((label, i) => (
          <option key={label} value={i + 1}>
            {label}
          </option>
        ))}
      </select>
      <select
        aria-label={t.laporan.periodFilter.dayAriaLabel}
        value={period.day ?? ""}
        onChange={(e) => {
          const value = e.target.value;
          onChange({ ...period, day: value === "" ? null : Number(value) });
        }}
        className="select w-full"
      >
        <option value="">{t.laporan.periodFilter.allDatesOption}</option>
        {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * EPIC-023 Task B (B1, US-RPT-12) — date-range presets, applied across every
 * /laporan sub-view. Selecting a preset other than "Custom" overrides the
 * year/month/day `PeriodFilter` above; picking "Custom" hands control back
 * to it (see `LaporanInner`'s `rangeStart`/`rangeEnd` derivation).
 */
const RANGE_PRESET_IDS: ReportRangePreset[] = [
  "thisMonth",
  "lastMonth",
  "last3Months",
  "last6Months",
  "last12Months",
  "thisYear",
  "lastYear",
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
