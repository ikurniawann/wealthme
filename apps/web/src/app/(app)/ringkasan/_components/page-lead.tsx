"use client";

// EPIC-026 — prototype `ringkasan.html` block 1: `.page-lead`
// (H1 `.section-title` + `.page-lead__sub`) with a `.row.row--wrap` of the
// `.segmented` range control and the "Sembunyikan nominal" privacy button.
//
// Honest UI: the prototype's third header button ("Ekspor", opening
// `#dlg-export`) is omitted — it is a pure mock in the prototype and this app
// has no ringkasan export endpoint. Real exports live on `/laporan`.

import { Eye, EyeOff } from "lucide-react";

import { useLocale } from "@/hooks/use-locale";
import type { TrendCustomRange, TrendRangeKey } from "./use-ringkasan-data";

export type DisplayCurrency = "IDR" | "USD" | "GOLD";

type PageLeadProps = {
  familyName: string;
  todayLabel: string;
  trendRange: TrendRangeKey;
  onTrendRangeChange: (range: TrendRangeKey) => void;
  customRange: TrendCustomRange;
  onCustomRangeChange: (range: TrendCustomRange) => void;
  displayCurrency: DisplayCurrency;
  onDisplayCurrencyChange: (c: DisplayCurrency) => void;
  privacyOn: boolean;
  onTogglePrivacy: () => void;
};

export function RingkasanPageLead({
  familyName,
  todayLabel,
  trendRange,
  onTrendRangeChange,
  customRange,
  onCustomRangeChange,
  displayCurrency,
  onDisplayCurrencyChange,
  privacyOn,
  onTogglePrivacy,
}: PageLeadProps) {
  const { t } = useLocale();
  const trendRanges: { key: TrendRangeKey; label: string }[] = [
    { key: "1m", label: t.ringkasan.trendRangeLabel1m },
    { key: "3m", label: t.ringkasan.trendRangeLabel3m },
    { key: "6m", label: t.ringkasan.trendRangeLabel6m },
    { key: "12m", label: t.ringkasan.trendRangeLabel12m },
    { key: "ytd", label: t.ringkasan.trendRangeLabelYtd },
    { key: "all", label: t.ringkasan.trendRangeLabelAll },
    { key: "custom", label: t.ringkasan.trendRangeLabelCustom },
  ];
  const currencies: { key: DisplayCurrency; label: string }[] = [
    { key: "IDR", label: t.ringkasan.currencyIdr },
    { key: "USD", label: t.ringkasan.currencyUsd },
    { key: "GOLD", label: t.ringkasan.currencyGold },
  ];

  return (
    <section className="page-lead">
      <div className="page-lead__text">
        <h1 className="section-title">{t.ringkasan.pageHeaderTitle}</h1>
        <div className="page-lead__sub">
          {familyName}
          {t.ringkasan.pageHeaderSubtitleConnector}
          {todayLabel}
        </div>
      </div>
      <div className="row row--wrap">
        <div
          role="tablist"
          aria-label={t.ringkasan.currencyGroupAriaLabel}
          className="segmented"
        >
          {currencies.map((c) => (
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
        <div
          role="tablist"
          aria-label={t.ringkasan.trendRangeGroupAriaLabel}
          className="segmented"
        >
          {trendRanges.map((range) => (
            <button
              key={range.key}
              type="button"
              role="tab"
              aria-selected={trendRange === range.key}
              onClick={() => onTrendRangeChange(range.key)}
              className="segmented__item"
            >
              {range.label}
            </button>
          ))}
        </div>
        {trendRange === "custom" && (
          <div className="row gap-2">
            <label className="t-xs t-muted" htmlFor="trend-from">
              {t.ringkasan.trendCustomFromLabel}
            </label>
            <input
              id="trend-from"
              type="date"
              className="input"
              style={{ width: 150 }}
              value={customRange.from}
              max={customRange.to || undefined}
              onChange={(e) =>
                onCustomRangeChange({ ...customRange, from: e.target.value })
              }
            />
            <label className="t-xs t-muted" htmlFor="trend-to">
              {t.ringkasan.trendCustomToLabel}
            </label>
            <input
              id="trend-to"
              type="date"
              className="input"
              style={{ width: 150 }}
              value={customRange.to}
              min={customRange.from || undefined}
              onChange={(e) =>
                onCustomRangeChange({ ...customRange, to: e.target.value })
              }
            />
          </div>
        )}
        <button
          type="button"
          className="btn btn--outline btn--sm"
          aria-pressed={privacyOn}
          aria-label={
            privacyOn
              ? t.ringkasan.showAmountsAriaLabel
              : t.ringkasan.hideAmountsAriaLabel
          }
          onClick={onTogglePrivacy}
        >
          {privacyOn ? (
            <Eye className="size-3.5" />
          ) : (
            <EyeOff className="size-3.5" />
          )}
          {privacyOn
            ? t.ringkasan.showAmountsButton
            : t.ringkasan.hideAmountsButton}
        </button>
      </div>
    </section>
  );
}
