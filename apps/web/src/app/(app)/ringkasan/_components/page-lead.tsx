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
import type { TrendRangeKey } from "./use-ringkasan-data";

type PageLeadProps = {
  familyName: string;
  todayLabel: string;
  trendRange: TrendRangeKey;
  onTrendRangeChange: (range: TrendRangeKey) => void;
  privacyOn: boolean;
  onTogglePrivacy: () => void;
};

export function RingkasanPageLead({
  familyName,
  todayLabel,
  trendRange,
  onTrendRangeChange,
  privacyOn,
  onTogglePrivacy,
}: PageLeadProps) {
  const { t } = useLocale();
  const trendRanges: { key: TrendRangeKey; label: string }[] = [
    { key: "6m", label: t.ringkasan.trendRangeLabel6m },
    { key: "12m", label: t.ringkasan.trendRangeLabel12m },
    { key: "all", label: t.ringkasan.trendRangeLabelAll },
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
