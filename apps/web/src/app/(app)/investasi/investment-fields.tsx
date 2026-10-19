"use client";
import { formatMoneyTyping, toCanonicalAmount } from "@/components/money";
export function AmountInput({
  label,
  currency,
  value,
  onChange,
  decimals = 2,
  required = false,
}: {
  label: string;
  currency: string;
  value: string;
  onChange: (value: string) => void;
  decimals?: number;
  required?: boolean;
}) {
  return (
    <label className="field">
      <span className="label">
        {label}
        {required ? " *" : ""} · {currency}
      </span>
      <input
        className="input mono"
        inputMode="decimal"
        required={required}
        value={value}
        onChange={(e) =>
          onChange(formatMoneyTyping(e.target.value, decimals, false))
        }
      />
    </label>
  );
}
export const amount = (value: string) => toCanonicalAmount(value) ?? "0";
export function today() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta" }).format(
    new Date(),
  );
}
/** A date-only entry stays at start of Jakarta day; no invented timestamp. */
export function effectiveInstant(date: string, time: string) {
  return `${date}T${time || "00:00"}:00+07:00`;
}
