"use client";

import { Plus, Trash2 } from "lucide-react";

import { useLocale } from "@/hooks/use-locale";

import {
  KPR_PRESETS,
  MAX_RATE_PERIODS,
  draftFromPreset,
  type KprPlanDraft,
  type KprPresetId,
  type RatePeriodDraft,
} from "./kpr-presets";

export function KprRatePeriodsField({
  value,
  onChange,
}: {
  value: KprPlanDraft;
  onChange: (next: KprPlanDraft) => void;
}) {
  const { t } = useLocale();
  const k = t.liabilitas.kpr;
  const lastIndex = value.periods.length - 1;
  const isSyariah =
    value.scheme === "syariah_murabahah" || value.scheme === "syariah_mmq";
  const rateLabel = isSyariah ? k.periodMarginLabel : k.periodRateLabel;
  const hasExample = value.periods.some((p) => p.source === "example");
  const hasOfficial = value.periods.some((p) => p.source === "official");

  function update(index: number, patch: Partial<RatePeriodDraft>) {
    onChange({
      ...value,
      periods: value.periods.map((period, i) =>
        i === index ? { ...period, ...patch } : period,
      ),
    });
  }

  function addPeriod() {
    const tier: RatePeriodDraft = {
      kind: "fixed",
      months: "12",
      ratePercent: "",
      source: "user",
    };
    onChange({
      ...value,
      periods: [
        ...value.periods.slice(0, lastIndex),
        tier,
        ...value.periods.slice(lastIndex),
      ],
    });
  }

  function removePeriod(index: number) {
    onChange({
      ...value,
      periods: value.periods.filter((_, i) => i !== index),
    });
  }

  return (
    <fieldset className="field mt-3">
      <legend className="label">{k.planLegend}</legend>
      <label className="label" htmlFor="kpr-preset">
        {k.presetLabel}
      </label>
      <select
        id="kpr-preset"
        className="select"
        value={value.presetId}
        onChange={(e) =>
          onChange(draftFromPreset(e.target.value as KprPresetId))
        }
      >
        {KPR_PRESETS.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {k.presetNames[preset.id]}
          </option>
        ))}
      </select>
      {hasOfficial && (
        <div className="notice notice--info mt-2">{k.officialRateNote}</div>
      )}
      {hasExample && (
        <div className="notice notice--warning mt-2">
          {k.exampleRateNote}
          {value.presetId === "syariah_mmq" ? ` ${k.mmqResetNote}` : ""}
        </div>
      )}

      <ol className="mt-2 space-y-2">
        {value.periods.map((period, index) => {
          const n = index + 1;
          const suffix = ` · ${k.periodLabel} ${n}`;
          const isLast = index === lastIndex;
          return (
            <li key={index} className="rounded-lg border p-2.5">
              <div className="mb-1.5 flex items-center justify-between text-[12.5px] font-semibold">
                <span>
                  {k.periodLabel} {n}
                </span>
                <span className="flex items-center gap-1.5">
                  {period.source === "example" && (
                    <span className="badge badge--warning">
                      {k.exampleBadge}
                    </span>
                  )}
                  {period.source === "official" && (
                    <span className="badge badge--info">{k.officialBadge}</span>
                  )}
                  {value.periods.length > 1 && (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      aria-label={`${k.removePeriod}${suffix}`}
                      onClick={() => removePeriod(index)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  )}
                </span>
              </div>
              <div className="field-row">
                <div className="field mt-0">
                  <label className="label" htmlFor={`kpr-period-${n}-kind`}>
                    {k.periodKindLabel}
                    <span className="sr-only">{suffix}</span>
                  </label>
                  <select
                    id={`kpr-period-${n}-kind`}
                    className="select"
                    value={period.kind}
                    onChange={(e) =>
                      update(index, {
                        kind: e.target.value as RatePeriodDraft["kind"],
                      })
                    }
                  >
                    <option value="fixed">{k.kindFixed}</option>
                    <option value="floating">{k.kindFloating}</option>
                  </select>
                </div>
                <div className="field mt-0">
                  {isLast ? (
                    <>
                      <span className="label">{k.periodMonthsLabel}</span>
                      <div className="input t-muted">{k.periodToMaturity}</div>
                    </>
                  ) : (
                    <>
                      <label
                        className="label"
                        htmlFor={`kpr-period-${n}-months`}
                      >
                        {k.periodMonthsLabel}
                        <span className="sr-only">{suffix}</span>
                      </label>
                      <input
                        id={`kpr-period-${n}-months`}
                        className="input mono"
                        inputMode="numeric"
                        value={period.months}
                        onChange={(e) =>
                          update(index, {
                            months: e.target.value.replace(/\D/g, ""),
                          })
                        }
                      />
                    </>
                  )}
                </div>
                <div className="field mt-0">
                  <label className="label" htmlFor={`kpr-period-${n}-rate`}>
                    {rateLabel}
                    <span className="sr-only">{suffix}</span>
                  </label>
                  <input
                    id={`kpr-period-${n}-rate`}
                    className="input mono"
                    inputMode="decimal"
                    value={period.ratePercent}
                    onChange={(e) =>
                      update(index, {
                        ratePercent: e.target.value,
                        source: "user",
                      })
                    }
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {value.periods.length < MAX_RATE_PERIODS && (
        <button
          type="button"
          className="btn btn--outline btn--sm mt-2"
          onClick={addPeriod}
        >
          <Plus className="size-4" aria-hidden="true" /> {k.addPeriod}
        </button>
      )}
      <div className="hint">{k.planHint}</div>
    </fieldset>
  );
}
