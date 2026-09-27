import {
  formatMoneyTyping,
  idrPreview,
  toCanonicalAmount,
} from "@/components/money/money-format";
import {
  isFxCurrency,
  type FxCurrencyCode,
  type FxInput,
  type FxRatesResponse,
} from "@wealthme/contracts";

import type { CrudField } from "./crud-config";

export const currencyKey = (key: string) => `${key}__currency`;
const fxKey = (key: string) => `${key}__fx`;

export function normalizeCrudMoney(
  fields: readonly CrudField[],
  values: Record<string, string>,
  rates: FxRatesResponse | undefined,
  fallbackCurrency: FxCurrencyCode,
): { values: Record<string, string>; pending: boolean } {
  let next = values;
  let pending = false;
  for (const f of fields) {
    if (f.type !== "amount") continue;
    const currency = values[currencyKey(f.key)] ?? fallbackCurrency;
    if (currency === "IDR" || !isFxCurrency(currency)) continue;
    const canonical = toCanonicalAmount(values[f.key] ?? "");
    if (canonical === null) continue;
    const preview = idrPreview(canonical, currency, rates, 0);
    if (preview === null) {
      pending = true;
      continue;
    }
    next = {
      ...next,
      [f.key]: formatMoneyTyping(preview.toString(), 0, f.allowNegative),
      [fxKey(f.key)]: JSON.stringify({ currency, amount: canonical }),
    };
  }
  return { values: next, pending };
}

export function withCrudFx<T extends object>(
  body: T,
  values: Record<string, string>,
  map: Record<string, string | readonly string[]>,
): T {
  const fxInputs: FxInput[] = Object.entries(map).flatMap(
    ([formKey, apiFields]) => {
      const raw = values[fxKey(formKey)];
      if (!raw) return [];
      const { currency, amount } = JSON.parse(raw) as Omit<FxInput, "field">;
      return (typeof apiFields === "string" ? [apiFields] : apiFields).map(
        (field) => ({ field, currency, amount }),
      );
    },
  );
  return fxInputs.length > 0 ? { ...body, fxInputs } : body;
}
