"use client";

import { MoneyInput, type useMoneyField } from "@/components/money";
import { useLocale } from "@/hooks/use-locale";
import { Req } from "./asset-form-sections";

/**
 * "Nilai saat ini": the Rp amount the form submits as `currentValue`, with
 * the per-unit quantity shown beside the label ("untuk 1.000 gram") so the
 * total is never mistaken for a price per unit.
 */
export function AssetValueField({
  field,
  isEdit,
  perUnit,
  qty,
  unit,
}: {
  field: ReturnType<typeof useMoneyField>;
  isEdit: boolean;
  perUnit: boolean;
  /** Valid opening quantity, else null. */
  qty: string | null;
  unit: string;
}) {
  const { t, locale } = useLocale();
  const f = t.aset.v3.form;
  const qtyText = qty
    ? `${new Intl.NumberFormat(locale === "en" ? "en-US" : "id-ID", {
        maximumFractionDigits: 8,
      }).format(Number(qty))} ${unit.trim() || "unit"}`
    : null;
  return (
    <div className="field">
      <div className="as4f-label-row">
        <label className="label" htmlFor="asset-value">
          {isEdit ? t.aset.fieldValueLabel : f.valueNow}
          <Req />
        </label>
        {perUnit && qtyText && (
          <span className="as4f-for">
            {f.valueSuffixFor.replace("{qty}", qtyText)}
          </span>
        )}
      </div>
      <MoneyInput
        field={field}
        id="asset-value"
        placeholder={t.aset.fieldValuePlaceholder}
        required
        ariaDescribedBy={isEdit ? undefined : "asset-value-hint"}
      />
      {!isEdit && (
        <span className="hint" id="asset-value-hint">
          {perUnit ? f.valueHintPerUnit : f.valueHintTotal}
        </span>
      )}
    </div>
  );
}
