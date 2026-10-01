"use client";

import { CURRENCIES, type CurrencyCode } from "@/hooks/currencies";
import { useCurrencyPreference } from "@/hooks/use-currency-preference";
import { useLocale } from "@/hooks/use-locale";
import { cn } from "@/lib/utils";

import {
  formatIdrPreview,
  formatRateDate,
  formatRatePerUnit,
} from "./money-format";

import type { MoneyField } from "./use-money-field";

export interface MoneyInputProps {
  field: MoneyField;
  id?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  inputClassName?: string;
}

export function MoneyInput({
  field,
  id,
  ariaLabel,
  ariaDescribedBy,
  placeholder = "0",
  disabled,
  required,
  inputClassName,
}: MoneyInputProps) {
  const { t } = useLocale();
  const inputMode = field.allowNegative
    ? "text"
    : field.decimals > 0
      ? "decimal"
      : "numeric";
  return (
    <div className="grid gap-1">
      <div className="flex gap-2">
        <select
          className="select money-cur shrink-0"
          aria-label={t.money.currencyLabel}
          value={field.currency}
          disabled={disabled}
          onChange={(e) => field.setCurrency(e.target.value as CurrencyCode)}
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {`${c.flag} ${c.code}`}
            </option>
          ))}
        </select>
        <input
          id={id}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          className={cn("input mono min-w-0 flex-1", inputClassName)}
          inputMode={inputMode}
          placeholder={placeholder}
          value={field.raw}
          disabled={disabled}
          required={required}
          onChange={(e) => field.setRaw(e.target.value)}
        />
      </div>
      <MoneyHint field={field} />
    </div>
  );
}

export function MoneyHint({ field }: { field: MoneyField }) {
  const { t, locale } = useLocale();
  const pref = useCurrencyPreference();
  const { resolved, currency, rates } = field;
  const displayHint =
    pref.isIndicative &&
    pref.isReady &&
    pref.currency !== currency &&
    resolved.idrPreview !== null
      ? t.money.convertedDisplay.replace(
          "{amount}",
          pref.formatMoney(Number(resolved.idrPreview) / 10 ** field.idrScale),
        )
      : null;

  if (currency === "IDR") {
    return displayHint ? <p className="t-xs t-muted">{displayHint}</p> : null;
  }
  if (field.isRateError) {
    return (
      <p className="t-xs text-destructive" role="alert">
        {t.money.rateUnavailable}
      </p>
    );
  }
  if (!rates) return <p className="t-xs t-muted">{t.money.rateLoading}</p>;

  const template =
    rates.source === "indicative"
      ? t.money.rateIndicative
      : rates.stale
        ? t.money.rateStale
        : t.money.rateLine;
  const rateText = template
    .replace("{code}", currency)
    .replace("{rate}", formatRatePerUnit(rates.idrPerUnit[currency] ?? "0"))
    .replace("{date}", formatRateDate(rates.rateDate, locale));

  return (
    <div className="t-xs t-muted" aria-live="polite">
      {resolved.idrPreview !== null && (
        <p className="t-bold">
          {t.money.convertedIdr.replace(
            "{amount}",
            formatIdrPreview(resolved.idrPreview, field.idrScale),
          )}
        </p>
      )}
      {displayHint && <p>{displayHint}</p>}
      <p>{rateText}</p>
      <p>{t.money.serverNote}</p>
      <p>{t.money.storedAsIdr.replace("{display}", pref.currency)}</p>
    </div>
  );
}
