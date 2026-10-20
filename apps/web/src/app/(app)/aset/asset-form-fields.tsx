"use client";

import {
  DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT,
  type AssetTypeId,
  type AssetValuationModel,
  type AssetValueChangeMode,
} from "@wealthme/contracts";
import { MoneyInput, type useMoneyField } from "@/components/money";
import { useLocale } from "@/hooks/use-locale";

/** One optional text field of the asset form (label always visible). */
export function TextField({
  id,
  label,
  placeholder,
  maxLength,
  value,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  maxLength: number;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input"
        placeholder={placeholder}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        enterKeyHint="next"
      />
    </div>
  );
}

/** Valuation model: one total value, or quantity × price per unit. */
export function ModelField({
  value,
  onChange,
}: {
  value: AssetValuationModel;
  onChange: (v: AssetValuationModel) => void;
}) {
  const { t } = useLocale();
  const c = t.aset.v3;
  return (
    <div className="field">
      <span className="label">{c.formModel}</span>
      <div
        className="segmented w-full"
        role="radiogroup"
        aria-label={c.formModel}
      >
        {(["total", "per_unit"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={value === m}
            onClick={() => onChange(m)}
            className="segmented__item flex-1"
          >
            {m === "total" ? c.formModelTotal : c.formModelPerUnit}
          </button>
        ))}
      </div>
      {value === "per_unit" && <span className="hint">{c.formModelHint}</span>}
    </div>
  );
}

/** Projection settings: % per year or a fixed Rp per year (estimate only). */
export function ChangeFields({
  type,
  mode,
  onMode,
  rate,
  onRate,
  changeField,
}: {
  type: AssetTypeId;
  mode: AssetValueChangeMode;
  onMode: (m: AssetValueChangeMode) => void;
  rate: string;
  onRate: (v: string) => void;
  changeField: ReturnType<typeof useMoneyField>;
}) {
  const { t } = useLocale();
  return (
    <>
      <div className="field">
        <span className="label">{t.aset.fieldValueChangeModeLabel}</span>
        <div
          className="segmented w-full"
          role="radiogroup"
          aria-label={t.aset.fieldValueChangeModeLabel}
        >
          {(["percent", "fixed"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => onMode(m)}
              className="segmented__item flex-1"
            >
              {m === "percent"
                ? t.aset.fieldValueChangeModePercentOption
                : t.aset.fieldValueChangeModeFixedOption}
            </button>
          ))}
        </div>
      </div>
      {mode === "percent" ? (
        <div className="field">
          <label className="label" htmlFor="asset-rate">
            {t.aset.fieldValueChangeRateLabel}
          </label>
          <input
            id="asset-rate"
            type="number"
            className="input"
            inputMode="decimal"
            step="0.01"
            min={-100}
            max={100}
            placeholder={t.aset.fieldValueChangeRatePlaceholder}
            value={rate}
            onChange={(e) => onRate(e.target.value)}
          />
          <span className="hint">
            {t.aset.defaultRateHelperPrefix}:{" "}
            {DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT[type]}%
          </span>
        </div>
      ) : (
        <div className="field">
          <label className="label" htmlFor="asset-change-amount">
            {t.aset.fieldValueChangeAmountLabel}
          </label>
          <MoneyInput
            field={changeField}
            id="asset-change-amount"
            placeholder={t.aset.fieldValueChangeAmountPlaceholder}
          />
        </div>
      )}
    </>
  );
}

/**
 * Starting quantity of a per-unit asset (create only). Required: a per-unit
 * value is quantity × price, so a missing quantity would price to Rp0.
 */
export function QuantityField({
  value,
  unit,
  error,
  onChange,
}: {
  value: string;
  unit: string;
  error: string | null;
  onChange: (v: string) => void;
}) {
  const { t } = useLocale();
  const c = t.aset.v3;
  return (
    <div className="field">
      <label className="label" htmlFor="asset-quantity">
        {c.formQty}
        {unit.trim() ? ` (${unit.trim()})` : ""}
      </label>
      <input
        id="asset-quantity"
        className="input"
        inputMode="decimal"
        placeholder={c.formQtyPh}
        maxLength={40}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        enterKeyHint="next"
        aria-required="true"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "asset-quantity-error" : undefined}
      />
      {error && (
        <p id="asset-quantity-error" className="error-text" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
