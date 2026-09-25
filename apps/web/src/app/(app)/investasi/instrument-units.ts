import type { QuantityUnit } from "./quantity-conversion";

export type InstrumentType =
  | "saham"
  | "reksa_dana"
  | "obligasi"
  | "emas"
  | "kripto"
  | "lainnya"
  | "deposito";

export type InstrumentUnitKind =
  | "shares"
  | "unit"
  | "gram"
  | "coin"
  | "nominal";

export interface InstrumentUnitSpec {
  kind: InstrumentUnitKind;
  /** Max fraction digits of the stored quantity; null = unrestricted. */
  maxDecimals: number | null;
}

// Revisi D item 9 — one map for the form, list, detail and Beli/Jual. Saham is stored in lembar.
export const UNIT_BY_TYPE: Record<InstrumentType, InstrumentUnitSpec> = {
  saham: { kind: "shares", maxDecimals: 0 },
  reksa_dana: { kind: "unit", maxDecimals: 4 },
  obligasi: { kind: "unit", maxDecimals: null },
  emas: { kind: "gram", maxDecimals: 3 },
  kripto: { kind: "coin", maxDecimals: 8 },
  lainnya: { kind: "unit", maxDecimals: null },
  deposito: { kind: "nominal", maxDecimals: null },
};

function specFor(type: string): InstrumentUnitSpec {
  return UNIT_BY_TYPE[type as InstrumentType] ?? UNIT_BY_TYPE.lainnya;
}

/** Decimals allowed in what the user types; a lot keeps 2 so 0.07 lot = 7 lembar. */
export function maxQuantityDecimals(
  type: string,
  quantityUnit: QuantityUnit,
): number | null {
  const spec = specFor(type);
  if (spec.kind === "shares") return quantityUnit === "lot" ? 2 : 0;
  return spec.maxDecimals;
}

export function quantityStep(type: string, quantityUnit: QuantityUnit): string {
  const decimals = maxQuantityDecimals(type, quantityUnit);
  if (decimals === null) return "any";
  if (decimals === 0) return "1";
  return `0.${"0".repeat(decimals - 1)}1`;
}

export function hasAtMostDecimals(value: string, max: number | null): boolean {
  if (max === null) return true;
  const fraction = value.trim().split(".")[1] ?? "";
  return fraction.replace(/0+$/, "").length <= max;
}

export interface UnitLabels {
  lot: string;
  lembar: string;
  unit: string;
  gram: string;
  coin: string;
}

export function quantityUnitLabel(
  type: string,
  quantityUnit: QuantityUnit,
  labels: UnitLabels,
): string {
  switch (specFor(type).kind) {
    case "shares":
      return quantityUnit === "lot" ? labels.lot : labels.lembar;
    case "gram":
      return labels.gram;
    case "coin":
      return labels.coin;
    default:
      return labels.unit;
  }
}

/** Display only — never feeds a stored value. */
export function formatQuantity(
  value: string,
  type: string,
  quantityUnit: QuantityUnit = "lembar",
): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n.toLocaleString("id-ID", {
    maximumFractionDigits: maxQuantityDecimals(type, quantityUnit) ?? 8,
  });
}
