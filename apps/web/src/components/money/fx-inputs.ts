import { formatScaled, type FxInput } from "@wealthme/contracts";

import type { MoneyField } from "./use-money-field";

interface ApiErrorLike {
  status?: number;
  message?: string;
}

/** I2 — the server refuses an fxInputs write with 503 when the snapshot is
 * indicative (no live rate). Map that one status to the friendly, localized
 * refusal copy instead of the server's raw technical message; every other
 * status passes through untouched (IDR submissions never send fxInputs, so
 * they never hit this branch). */
export function extractApiErrorMessage(
  error: unknown,
  t: { money: { fxIndicativeRefused: string } },
): string | null {
  const apiError = error as ApiErrorLike;
  if (apiError?.status === 503) return t.money.fxIndicativeRefused;
  return null;
}

/** Legacy IDR number: the exact old parse for IDR, the (informational) preview for a foreign currency. */
export function moneyIdr(
  field: MoneyField,
  parseIdr: (raw: string) => number,
): number {
  if (field.currency === "IDR") return parseIdr(field.raw);
  return field.resolved.idrPreview === null
    ? 0
    : Number(field.resolved.idrPreview);
}

export function moneyIdrString(
  field: MoneyField,
  parseIdr: (raw: string) => number,
): string {
  return String(moneyIdr(field, parseIdr));
}

/** Digit-string wire value: IDR → the old strip (keeping "-" only when allowed); foreign → the preview. */
export function moneyDigits(field: MoneyField): string {
  if (field.currency === "IDR") {
    return field.raw.replace(field.allowNegative ? /[^-\d]/g : /\D/g, "");
  }
  return field.resolved.idrPreview === null
    ? ""
    : field.resolved.idrPreview.toString();
}

/** decimal2 fields (investment unit prices): canonical rupiah with sen. */
export function moneyIdrDecimal(
  field: MoneyField,
  idrCanonical: () => string,
): string {
  if (field.currency === "IDR") return idrCanonical();
  return field.resolved.idrPreview === null
    ? "0"
    : formatScaled(field.resolved.idrPreview, 2);
}

export function withFxInputs<T extends object>(
  body: T,
  entries: ReadonlyArray<readonly [string, MoneyField | null | undefined]>,
): T {
  const fxInputs: FxInput[] = entries.flatMap(([field, money]) =>
    money?.resolved.fx ? [{ field, ...money.resolved.fx }] : [],
  );
  return fxInputs.length > 0 ? { ...body, fxInputs } : body;
}

export function anyMoneyPending(
  ...fields: ReadonlyArray<MoneyField | null | undefined>
): boolean {
  return fields.some((f) => !!f?.resolved.isPending);
}
