"use client";
import { useId } from "react";
import type { ReactNode } from "react";
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

/**
 * One labelled control in the add-investment drawer / buy-sell dialog. The
 * label is a real <label for>, so composite controls (quantity + unit) still
 * name their primary input. Layout (grid cell vs label-left row) belongs to
 * the container in trade-position.css.
 */
export function Field({
  label,
  required = false,
  hint,
  wide = false,
  children,
}: {
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  wide?: boolean;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="ivx-field" data-wide={wide || undefined}>
      <label className="ivx-label" htmlFor={id}>
        {label}
        {required && (
          <span className="ivx-req" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      <div className="ivx-control">
        {children(id)}
        {hint && <small className="ivx-hint">{hint}</small>}
      </div>
    </div>
  );
}

/** Currency mark shown inside a money input ("Rp", "USD", "%"). */
export function currencyMark(currency: string) {
  return currency === "IDR" ? "Rp" : currency;
}

/** Money / price input with a leading currency mark and optional suffix. */
export function MoneyInput({
  id,
  currency,
  value,
  onChange,
  decimals = 2,
  required = false,
  suffix,
  invalid = false,
}: {
  id: string;
  currency: string;
  value: string;
  onChange: (value: string) => void;
  decimals?: number;
  required?: boolean;
  suffix?: string;
  invalid?: boolean;
}) {
  return (
    <div className="ivx-adorn">
      <span className="ivx-mark" aria-hidden="true">
        {currencyMark(currency)}
      </span>
      <input
        id={id}
        className="input mono"
        enterKeyHint="next"
        inputMode="decimal"
        autoComplete="off"
        required={required}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        value={value}
        onChange={(e) =>
          onChange(formatMoneyTyping(e.target.value, decimals, false))
        }
      />
      {suffix && (
        <span className="ivx-suffix" aria-hidden="true">
          {suffix}
        </span>
      )}
    </div>
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

/** Time zones offered next to a known execution time. */
export const TIME_ZONES = [
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Jayapura",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/London",
  "America/New_York",
  "UTC",
] as const;
