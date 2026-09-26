"use client";

import { useMemo, useState } from "react";
import {
  FX_CURRENCY_DECIMALS,
  isFxCurrency,
  type ForeignFxCurrencyCode,
  type FxCurrencyCode,
  type FxRatesResponse,
} from "@wealthme/contracts";

import { useCurrencyPreference } from "@/hooks/use-currency-preference";

import {
  formatMoneyTyping,
  idrPreview,
  toCanonicalAmount,
} from "./money-format";
import { useFxSnapshot } from "./use-fx-snapshot";

export interface ResolvedMoney {
  canonical: string | null;
  idrPreview: bigint | null;
  isPending: boolean;
  fx: { currency: ForeignFxCurrencyCode; amount: string } | null;
}

export interface MoneyField {
  raw: string;
  currency: FxCurrencyCode;
  decimals: number;
  allowNegative: boolean;
  idrScale: 0 | 2;
  setRaw: (next: string) => void;
  setCurrency: (next: FxCurrencyCode) => void;
  reset: (raw?: string) => void;
  resolved: ResolvedMoney;
  rates: FxRatesResponse | undefined;
  isRateError: boolean;
}

interface ControlledArgs {
  raw: string;
  /** null = not chosen yet: follow the user's display currency until the first edit. */
  currency: FxCurrencyCode | null;
  onChange: (next: { raw: string; currency: FxCurrencyCode }) => void;
  allowNegative?: boolean;
  idrScale?: 0 | 2;
}

function decimalsFor(currency: FxCurrencyCode, idrScale: 0 | 2): number {
  return currency === "IDR" ? idrScale : FX_CURRENCY_DECIMALS[currency];
}

export function useDefaultMoneyCurrency(): FxCurrencyCode {
  const { currency } = useCurrencyPreference();
  return isFxCurrency(currency) ? currency : "IDR";
}

export function useControlledMoneyField({
  raw,
  currency: chosen,
  onChange,
  allowNegative = false,
  idrScale = 0,
}: ControlledArgs): MoneyField {
  const fallback = useDefaultMoneyCurrency();
  const currency = chosen ?? fallback;
  const isForeign = currency !== "IDR";
  const { data: rates, isError } = useFxSnapshot(isForeign);
  const decimals = decimalsFor(currency, idrScale);

  const resolved = useMemo<ResolvedMoney>(() => {
    const canonical = toCanonicalAmount(raw);
    const preview = idrPreview(canonical, currency, rates, idrScale);
    return {
      canonical,
      idrPreview: preview,
      isPending: isForeign && canonical !== null && preview === null,
      fx:
        isForeign && canonical !== null
          ? { currency: currency as ForeignFxCurrencyCode, amount: canonical }
          : null,
    };
  }, [raw, currency, rates, idrScale, isForeign]);

  return {
    raw,
    currency,
    decimals,
    allowNegative,
    idrScale,
    resolved,
    rates: isForeign ? rates : undefined,
    isRateError: isForeign && isError,
    // Any edit latches the effective currency (Decision 12).
    setRaw: (next) =>
      onChange({
        raw: formatMoneyTyping(next, decimals, allowNegative),
        currency,
      }),
    setCurrency: (next) =>
      onChange({
        raw: formatMoneyTyping(raw, decimalsFor(next, idrScale), allowNegative),
        currency: next,
      }),
    reset: (next = "") =>
      onChange({
        raw: formatMoneyTyping(
          next,
          decimalsFor("IDR", idrScale),
          allowNegative,
        ),
        currency: "IDR",
      }),
  };
}

export function useMoneyField(
  options: {
    initialRaw?: string;
    isEdit?: boolean;
    allowNegative?: boolean;
    idrScale?: 0 | 2;
  } = {},
): MoneyField {
  const {
    initialRaw,
    isEdit = false,
    allowNegative = false,
    idrScale = 0,
  } = options;
  // null = "not chosen yet, follow the display currency"; edit forms / stored IDR prefills pin IDR (Decision 9).
  const [state, setState] = useState<{
    raw: string;
    currency: FxCurrencyCode | null;
  }>(() => ({
    raw: formatMoneyTyping(initialRaw ?? "", idrScale, allowNegative),
    currency: initialRaw || isEdit ? "IDR" : null,
  }));
  const field = useControlledMoneyField({
    ...state,
    onChange: setState,
    allowNegative,
    idrScale,
  });
  return {
    ...field,
    reset: (next) =>
      setState(
        next
          ? {
              raw: formatMoneyTyping(next, idrScale, allowNegative),
              currency: "IDR",
            }
          : { raw: "", currency: null },
      ),
  };
}
