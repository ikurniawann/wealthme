"use client";
import { useLocale } from "@/hooks/use-locale";
import type { PositionState } from "./position-state";

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
    <label key={key} className="field">
      <span className="label">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        className="input"
        type={type}
        required={required}
        step={type === "number" ? "any" : undefined}
        min={type === "number" ? 0 : undefined}
        maxLength={200}
        value={d[key] ?? ""}
        onChange={(e) => set(key, e.target.value)}
      />
    </label>
  );
  const select = (key: string, label: string, options: readonly string[]) => (
    <label className="field">
      <span className="label">{label}</span>
      <select
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
    </label>
  );
  if (value.type === "obligasi")
    return (
      <div className="iv-field-row">
        {input("instrumentCode", f.bondCode)}
        {input("issuer", f.issuer)}
        {select("priceConvention", f.priceConvention, [
          "percent_of_par",
          "per_unit",
        ])}
        {input("couponRatePct", f.couponRate, "number")}
        {input("couponFrequency", f.couponFrequency, "number")}
        {input("maturityDate", f.maturityDate, "date")}
        <label className="field">
          <span>
            <input
              type="checkbox"
              checked={d.pricesIncludeAccrued === "true"}
              onChange={(e) =>
                set("pricesIncludeAccrued", String(e.target.checked))
              }
            />
            {f.pricesIncludeAccrued}
          </span>
        </label>
      </div>
    );
  if (value.type === "emas")
    return (
      <div className="iv-field-row">
        {select("form", f.goldForm, ["physical", "digital"])}
        {input("unit", f.unit, "text", true)}
        {input("purity", f.purity)}
        {input("brand", f.brand)}
      </div>
    );
  if (value.type === "deposito")
    return (
      <div className="iv-field-row">
        {input("bankName", f.bankName, "text", true)}
        {input("ratePct", f.ratePct, "number", true)}
        {input("startDate", f.startDate, "date")}
        {input("maturityDate", f.maturityDate, "date", true)}
        {select("rollover", f.rollover, ["non_aro", "aro", "aro_plus"])}
      </div>
    );
  if (value.type === "lainnya")
    return (
      <div className="iv-field-row">
        {input("unit", f.unit, "text", true)}
        {select("valuationMethod", f.valuationMethod, [
          "manual_price",
          "fixed_cost",
        ])}
      </div>
    );
  return null;
}
