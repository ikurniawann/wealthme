"use client";

import { useState } from "react";
import { FX_CURRENCY_CODES } from "@wealthme/contracts";
import { useFxSnapshot } from "@/components/money";
import { nowTime, TIME_ZONES, today } from "../../investasi/investment-fields";
import { fillCopy } from "../aset-model";
import { groupTyping, typedToDecimal } from "./detail-model";

/**
 * Shared fields for the Update nilai and Catat beli/jual drawers. Styling
 * comes from the `.ivx` drawer shell (investasi/trade-position.css): 44px
 * controls, 16px inputs on phones, label + error next to each field.
 */

export function Field({
  id,
  label,
  required,
  hint,
  error,
  wide,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
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
      {children}
      {hint && (
        <small className="ivx-hint" id={`${id}-hint`}>
          {hint}
        </small>
      )}
      {error && (
        <small className="ivx-field-error" id={`${id}-err`} role="alert">
          {error}
        </small>
      )}
    </div>
  );
}

/** Grouped decimal input (id-ID typing: "1.100.000,5") with a currency mark. */
export function AmountInput({
  id,
  mark,
  suffix,
  value,
  onChange,
  invalid,
  required,
  describedBy,
}: {
  id: string;
  mark?: string;
  suffix?: string;
  value: string;
  onChange: (typed: string) => void;
  invalid?: boolean;
  required?: boolean;
  describedBy?: string;
}) {
  return (
    <div className="ivx-adorn" data-nomark={mark ? undefined : true}>
      {mark && (
        <span className="ivx-mark" aria-hidden="true">
          {mark}
        </span>
      )}
      <input
        id={id}
        className="input mono"
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="next"
        required={required}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        value={value}
        onChange={(e) => onChange(groupTyping(e.target.value))}
      />
      {suffix && (
        <span className="ivx-suffix" aria-hidden="true">
          {suffix}
        </span>
      )}
    </div>
  );
}

/**
 * Effective date/time state. Ruling (investasi c5c70136): an entry dated
 * today starts with the current Asia/Jakarta time (editable, clearable);
 * moving to a past date drops the prefill (date-only); a typed time stays.
 */
export function useWhen() {
  const [date, setDateRaw] = useState(today);
  const [time, setTimeRaw] = useState(nowTime);
  const [zone, setZone] = useState("Asia/Jakarta");
  const [touched, setTouched] = useState(false);
  return {
    date,
    time,
    zone,
    setZone,
    setDate(next: string) {
      setDateRaw(next);
      if (!touched) setTimeRaw(next === today() ? nowTime() : "");
    },
    setTime(next: string) {
      setTouched(true);
      setTimeRaw(next);
    },
    /** Zone only matters when a clock time is known. */
    body() {
      return {
        effectiveDate: date,
        effectiveTime: time || null,
        timeZone: time ? zone : null,
      };
    },
  };
}
export type WhenState = ReturnType<typeof useWhen>;

export function WhenFields({
  idBase,
  when,
  dateLabel,
  timeLabel,
  zoneLabel,
  timeHint,
  error,
}: {
  idBase: string;
  when: WhenState;
  dateLabel: string;
  timeLabel: string;
  zoneLabel: string;
  timeHint: string;
  error?: string;
}) {
  return (
    <>
      <Field id={`${idBase}-date`} label={dateLabel} required error={error}>
        <input
          id={`${idBase}-date`}
          className="input"
          type="date"
          required
          max={today()}
          enterKeyHint="next"
          aria-invalid={error ? true : undefined}
          value={when.date}
          onChange={(e) => when.setDate(e.target.value)}
        />
      </Field>
      <Field id={`${idBase}-time`} label={timeLabel} hint={timeHint}>
        <input
          id={`${idBase}-time`}
          className="input"
          type="time"
          enterKeyHint="next"
          aria-describedby={`${idBase}-time-hint`}
          value={when.time}
          onChange={(e) => when.setTime(e.target.value)}
        />
      </Field>
      <Field id={`${idBase}-zone`} label={zoneLabel} wide>
        <select
          id={`${idBase}-zone`}
          className="select"
          value={when.zone}
          disabled={!when.time}
          onChange={(e) => when.setZone(e.target.value)}
        >
          {TIME_ZONES.map((z) => (
            <option key={z} value={z}>
              {z === "Asia/Jakarta" ? "Asia/Jakarta (WIB)" : z}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}

/**
 * Currency + (for non-IDR) the IDR rate stored with the entry. The rate is
 * prefilled from the FX snapshot and stays editable; the server stores it
 * as fxSource=user with the entry's date.
 */
export function useCurrency(initial: string) {
  const start = (FX_CURRENCY_CODES as readonly string[]).includes(initial)
    ? initial
    : "IDR";
  const [currency, setCurrencyRaw] = useState(start);
  const [rate, setRate] = useState("");
  const fx = useFxSnapshot(currency !== "IDR");
  const snapshot = fx.data?.idrPerUnit?.[currency];
  const shownRate =
    rate || (snapshot ? groupTyping(snapshot.replace(".", ",")) : "");
  return {
    currency,
    rateTyped: shownRate,
    setCurrency(next: string) {
      setCurrencyRaw(next);
      setRate("");
    },
    setRate,
    fxRate(): string | null {
      return currency === "IDR" ? null : typedToDecimal(shownRate) || null;
    },
  };
}
export type CurrencyState = ReturnType<typeof useCurrency>;

export function CurrencyFields({
  idBase,
  state,
  currencyLabel,
  rateLabel,
  rateHint,
}: {
  idBase: string;
  state: CurrencyState;
  currencyLabel: string;
  rateLabel: string;
  rateHint: string;
}) {
  return (
    <>
      <Field id={`${idBase}-cur`} label={currencyLabel}>
        <select
          id={`${idBase}-cur`}
          className="select"
          value={state.currency}
          onChange={(e) => state.setCurrency(e.target.value)}
        >
          {FX_CURRENCY_CODES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
      {state.currency !== "IDR" ? (
        <Field
          id={`${idBase}-rate`}
          label={fillCopy(rateLabel, { currency: state.currency })}
          required
          hint={rateHint}
        >
          <AmountInput
            id={`${idBase}-rate`}
            mark="Rp"
            value={state.rateTyped}
            onChange={state.setRate}
            required
            describedBy={`${idBase}-rate-hint`}
          />
        </Field>
      ) : null}
    </>
  );
}
