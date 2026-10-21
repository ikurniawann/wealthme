"use client";
import { useLocale } from "@/hooks/use-locale";
import { Field } from "./investment-fields";
import type { PositionState } from "./position-state";

const GOLD_UNITS = ["gram"] as const;
const OTHER_UNITS = [
  "unit",
  "lembar",
  "lot",
  "unit penyertaan",
  "buah",
  "bidang",
] as const;

/** Fields only one asset type has (bond, gold, deposit, other). */
export function PositionTypeFields({
  value,
  onChange,
}: {
  value: PositionState;
  onChange: (value: PositionState) => void;
}) {
  const { t } = useLocale();
  const f = t.investasi.forms;
  const d = value.details;
  const set = (key: string, next: string) =>
    onChange({ ...value, details: { ...d, [key]: next } });
  const input = (
    key: string,
    label: string,
    type = "text",
    required = false,
  ) => (
    <Field key={key} label={label} required={required}>
      {(id) => (
        <input
          id={id}
          className={type === "number" ? "input mono" : "input"}
          type={type}
          required={required}
          step={type === "number" ? "any" : undefined}
          min={type === "number" ? 0 : undefined}
          inputMode={type === "number" ? "decimal" : undefined}
          enterKeyHint="next"
          maxLength={200}
          value={d[key] ?? ""}
          onChange={(e) => set(key, e.target.value)}
        />
      )}
    </Field>
  );
  const select = (key: string, label: string, options: readonly string[]) => (
    <Field key={key} label={label}>
      {(id) => (
        <select
          id={id}
          className="select"
          value={d[key] ?? options[0]}
          onChange={(e) => set(key, e.target.value)}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {f[option as keyof typeof f] ?? option}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
  // Gold prices per gram, so gram is the only unit the valuation understands;
  // a legacy free-text unit stays selectable so editing never rewrites it.
  const unitSelect = (options: readonly string[]) => {
    const current = d.unit || options[0]!;
    const all = options.includes(current) ? options : [current, ...options];
    return (
      <Field key="unit" label={f.unit} required>
        {(id) => (
          <select
            id={id}
            className="select"
            value={current}
            onChange={(e) => set("unit", e.target.value)}
          >
            {all.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )}
      </Field>
    );
  };
  if (value.type === "obligasi")
    return (
      <>
        {input("instrumentCode", f.bondCode)}
        {input("issuer", f.issuer)}
        {select("priceConvention", f.priceConvention, [
          "percent_of_par",
          "per_unit",
        ])}
        {input("couponRatePct", f.couponRate, "number")}
        {input("couponFrequency", f.couponFrequency, "number")}
        {input("maturityDate", f.maturityDate, "date")}
        <label className="ivx-check" data-wide>
          <input
            type="checkbox"
            checked={d.pricesIncludeAccrued === "true"}
            onChange={(e) =>
              set("pricesIncludeAccrued", String(e.target.checked))
            }
          />
          <span>{f.pricesIncludeAccrued}</span>
        </label>
      </>
    );
  if (value.type === "emas")
    return (
      <>
        {select("form", f.goldForm, ["physical", "digital"])}
        {unitSelect(GOLD_UNITS)}
        {input("purity", f.purity)}
        {input("brand", f.brand)}
      </>
    );
  if (value.type === "deposito")
    return (
      <>
        {input("bankName", f.bankName, "text", true)}
        {input("ratePct", f.ratePct, "number", true)}
        {input("startDate", f.startDate, "date")}
        {input("maturityDate", f.maturityDate, "date", true)}
        {select("rollover", f.rollover, ["non_aro", "aro", "aro_plus"])}
      </>
    );
  if (value.type === "lainnya")
    return (
      <>
        {unitSelect(OTHER_UNITS)}
        {select("valuationMethod", f.valuationMethod, [
          "manual_price",
          "fixed_cost",
        ])}
      </>
    );
  return null;
}
