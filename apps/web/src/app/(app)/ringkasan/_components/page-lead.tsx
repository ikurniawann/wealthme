"use client";

// Structural port fidelity follow-up — `docs/design/proto/ringkasan.html`'s
// `.r-hero .hero-ctrl` block: the currency segmented control + trend-range
// select + privacy toggle sit INSIDE the hero's top-right corner, not in a
// standalone page-header row above it. This component used to also render
// the page's H1 + "<family> · per <date>" subtitle (the prototype has no
// such title row at all) — that text was removed; `RingkasanHeroControls`
// now renders only the compact control row, composed inside
// `HeroStatsSection`'s `controls` slot (which maps to `BentoHero`'s own
// `controls` prop).
//
// Honest UI: the prototype's third header button ("Ekspor", opening
// `#dlg-export`) is omitted — it is a pure mock in the prototype and this app
// has no ringkasan export endpoint. Real exports live on `/laporan`.

import { Popover } from "@base-ui/react/popover";
import { Eye, EyeOff, SlidersHorizontal } from "lucide-react";

import { DateRangeFilterField } from "@/components/wm";
import { FOREIGN_CURRENCIES } from "@/hooks/currencies";
import { useLocale } from "@/hooks/use-locale";
import { useMediaQuery } from "@/hooks/use-media-query";
import { isForeignCurrency, type DisplayCurrency } from "./display-currency";
import type { TrendCustomRange, TrendRangeKey } from "./use-ringkasan-data";

// design-system.css styles the active segment via [aria-selected], which a <select> cannot carry.
const ACTIVE_SEGMENT_STYLE = {
  background: "var(--card)",
  color: "var(--foreground)",
  boxShadow: "var(--shadow-card)",
} as const;

type PageLeadProps = {
  trendRange: TrendRangeKey;
  onTrendRangeChange: (range: TrendRangeKey) => void;
  customRange: TrendCustomRange;
  onCustomRangeChange: (range: TrendCustomRange) => void;
  displayCurrency: DisplayCurrency;
  onDisplayCurrencyChange: (c: DisplayCurrency) => void;
  privacyOn: boolean;
  onTogglePrivacy: () => void;
  /** The range select only acts on the net-worth trend; the hero hides it while no trend is drawn. */
  showTrendRange?: boolean;
};

/** The compact control row that lives inside the hero's top-right corner. */
export function RingkasanPageLead({
  trendRange,
  onTrendRangeChange,
  customRange,
  onCustomRangeChange,
  displayCurrency,
  onDisplayCurrencyChange,
  privacyOn,
  onTogglePrivacy,
  showTrendRange = true,
}: PageLeadProps) {
  const { t, locale } = useLocale();
  const trendRanges: { key: TrendRangeKey; label: string }[] = [
    { key: "1m", label: t.ringkasan.trendRangeLabel1m },
    { key: "3m", label: t.ringkasan.trendRangeLabel3m },
    { key: "6m", label: t.ringkasan.trendRangeLabel6m },
    { key: "12m", label: t.ringkasan.trendRangeLabel12m },
    { key: "ytd", label: t.ringkasan.trendRangeLabelYtd },
    { key: "all", label: t.ringkasan.trendRangeLabelAll },
    { key: "custom", label: t.ringkasan.trendRangeLabelCustom },
  ];
  const fixedCurrencies: { key: "IDR" | "GOLD"; label: string }[] = [
    { key: "IDR", label: t.ringkasan.currencyIdr },
    { key: "GOLD", label: t.ringkasan.currencyGold },
  ];
  const foreignSelected = isForeignCurrency(displayCurrency);
  const compact = useMediaQuery("(max-width: 720px)");

  const currencyGroup = (
    <div
      role="group"
      aria-label={t.ringkasan.currencyGroupAriaLabel}
      className="segmented"
    >
      <div
        role="tablist"
        aria-label={t.ringkasan.currencyGroupAriaLabel}
        className="contents"
      >
        {fixedCurrencies.map((c) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={displayCurrency === c.key}
            onClick={() => onDisplayCurrencyChange(c.key)}
            className="segmented__item"
          >
            {c.label}
          </button>
        ))}
      </div>
      <select
        aria-label={t.ringkasan.currencyForeignAriaLabel}
        className="segmented__item"
        style={foreignSelected ? ACTIVE_SEGMENT_STYLE : undefined}
        value={foreignSelected ? displayCurrency : ""}
        onChange={(e) => {
          const next = FOREIGN_CURRENCIES.find(
            (c) => c.code === e.target.value,
          );
          if (next) onDisplayCurrencyChange(next.code);
        }}
      >
        <option value="" disabled hidden>
          {t.ringkasan.currencyForeignPlaceholder}
        </option>
        {FOREIGN_CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {`${c.flag} ${c.code}`}
          </option>
        ))}
      </select>
    </div>
  );
  const rangeSelect = showTrendRange && (
    <div className="segmented">
      <select
        aria-label={t.ringkasan.trendRangeGroupAriaLabel}
        className="segmented__item"
        style={ACTIVE_SEGMENT_STYLE}
        value={trendRange}
        onChange={(e) => onTrendRangeChange(e.target.value as TrendRangeKey)}
      >
        {trendRanges.map((range) => (
          <option key={range.key} value={range.key}>
            {range.label}
          </option>
        ))}
      </select>
    </div>
  );
  const customPicker = trendRange === "custom" && (
    <div className="min-w-[240px]">
      <DateRangeFilterField
        from={customRange.from}
        to={customRange.to}
        locale={locale}
        label={t.ringkasan.trendRangeLabelCustom}
        cancelLabel={t.common.cancel}
        applyLabel={t.common.apply}
        onApply={(from, to) => onCustomRangeChange({ from, to })}
      />
    </div>
  );
  const privacyLabel = privacyOn
    ? t.ringkasan.showAmountsButton
    : t.ringkasan.hideAmountsButton;
  const privacyIcon = privacyOn ? (
    <Eye className="size-3.5" />
  ) : (
    <EyeOff className="size-3.5" />
  );

  if (compact) {
    // Phones: [IDR | Emas | Valas] stays in view; range, custom range and the
    // hide-amounts toggle fold into one "Atur" popover.
    return (
      <div className="row rk2-hero-ctrl-row rk2-hero-ctrl-row--compact">
        {currencyGroup}
        <Popover.Root>
          <Popover.Trigger
            aria-label={t.ringkasan.heroSettingsAriaLabel}
            className="btn btn--outline btn--sm rk2-hero-atur"
          >
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            {t.ringkasan.heroSettingsButton}
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner
              side="bottom"
              align="end"
              sideOffset={6}
              className="isolate z-50"
            >
              <Popover.Popup className="rk2-atur-pop flex w-[min(300px,calc(100vw-2rem))] flex-col gap-3 rounded-xl border bg-card p-3 text-foreground shadow-lg outline-none">
                {rangeSelect}
                {customPicker}
                <button
                  type="button"
                  className="btn btn--outline"
                  aria-pressed={privacyOn}
                  onClick={onTogglePrivacy}
                >
                  {privacyIcon}
                  {privacyLabel}
                </button>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </div>
    );
  }

  return (
    <>
      <div className="row row--wrap rk2-hero-ctrl-row">
        {currencyGroup}
        {rangeSelect}
        {customPicker}
        <button
          type="button"
          className="btn btn--outline btn--sm btn--icon"
          aria-pressed={privacyOn}
          aria-label={
            privacyOn
              ? t.ringkasan.showAmountsAriaLabel
              : t.ringkasan.hideAmountsAriaLabel
          }
          title={privacyLabel}
          onClick={onTogglePrivacy}
        >
          {privacyIcon}
        </button>
      </div>
    </>
  );
}
