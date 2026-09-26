import { BadRequestException } from "@nestjs/common";
import {
  convertToIdr,
  formatScaled,
  FX_CURRENCY_DECIMALS,
  parseMinor,
  type ForeignFxCurrencyCode,
} from "@wealthme/contracts";

import type { FxSnapshot } from "./fx-snapshot";

export type FxFieldKind = "int" | "digits" | "decimal2";
export interface FxFieldRule {
  kind: FxFieldKind;
  allowNegative?: boolean;
  positive?: boolean;
  max?: bigint;
}
export type FxFieldSpec = Readonly<Record<string, FxFieldRule>>;

export interface FxInputLike {
  field: string;
  currency: ForeignFxCurrencyCode;
  amount: string;
}
export interface PendingFxConversion {
  field: string;
  originalAmount: string;
  originalCurrency: ForeignFxCurrencyCode;
  idrAmount: string;
  idrPerUnit: string;
  rateDate: string;
  rateSource: string;
  rateStale: boolean;
}
export interface FxOverride {
  path: string;
  value: number | string;
}
export interface FxResolution {
  overrides: FxOverride[];
  pending: PendingFxConversion[];
}

const bad = (field: string, why: string) =>
  new BadRequestException(`fxInputs: ${field}: ${why}`);

function ruleFor(spec: FxFieldSpec, field: string): FxFieldRule | undefined {
  return spec[field] ?? spec[field.replace(/\.\d+\./, ".*.")];
}

export function resolveFxInputs(
  inputs: readonly FxInputLike[],
  spec: FxFieldSpec,
  snapshot: FxSnapshot,
): FxResolution {
  const seen = new Set<string>();
  const overrides: FxOverride[] = [];
  const pending: PendingFxConversion[] = [];
  for (const input of inputs) {
    const rule = ruleFor(spec, input.field);
    if (!rule)
      throw bad(input.field, "not a convertible money field on this route");
    if (seen.has(input.field)) throw bad(input.field, "listed twice");
    seen.add(input.field);

    const targetScale = rule.kind === "decimal2" ? 2 : 0;
    let idr: bigint;
    let original: bigint;
    try {
      original = parseMinor(input.amount, input.currency);
      idr = convertToIdr({
        amount: input.amount,
        currency: input.currency,
        idrPerUnit: snapshot.idrPerUnit[input.currency],
        targetScale,
      });
    } catch (err) {
      throw bad(
        input.field,
        err instanceof Error ? err.message : "invalid amount",
      );
    }
    const magnitude = idr < 0n ? -idr : idr;
    if (idr < 0n && !rule.allowNegative)
      throw bad(input.field, "must not be negative");
    if (rule.positive && idr <= 0n)
      throw bad(input.field, "must be greater than zero");
    if (rule.max !== undefined && magnitude > rule.max)
      throw bad(input.field, "exceeds the maximum");
    if (rule.kind === "int" && magnitude > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw bad(input.field, "exceeds the maximum");
    }

    overrides.push({
      path: input.field,
      value:
        rule.kind === "int"
          ? Number(idr)
          : rule.kind === "digits"
            ? idr.toString()
            : formatScaled(idr, 2),
    });
    pending.push({
      field: input.field,
      originalAmount: formatScaled(
        original,
        FX_CURRENCY_DECIMALS[input.currency],
      ),
      originalCurrency: input.currency,
      idrAmount: formatScaled(idr, targetScale),
      idrPerUnit: snapshot.idrPerUnit[input.currency],
      rateDate: snapshot.rateDate,
      rateSource: snapshot.source,
      rateStale: snapshot.stale,
    });
  }
  return { overrides, pending };
}

function setPath(
  target: unknown,
  [head, ...rest]: string[],
  value: unknown,
  full: string,
): unknown {
  if (head === undefined) return value;
  if (Array.isArray(target)) {
    const index = Number(head);
    if (!Number.isInteger(index) || index < 0 || index >= target.length) {
      throw bad(full, `no element ${head}`);
    }
    return target.map((el, i) =>
      i === index ? setPath(el, rest, value, full) : el,
    );
  }
  if (typeof target !== "object" || target === null)
    throw bad(full, "path does not exist");
  const record = target as Record<string, unknown>;
  return { ...record, [head]: setPath(record[head], rest, value, full) };
}

export function applyFxOverrides<T extends object>(
  dto: T,
  overrides: readonly FxOverride[],
): T {
  return overrides.reduce<unknown>(
    (acc, o) => setPath(acc, o.path.split("."), o.value, o.path),
    dto,
  ) as T;
}
