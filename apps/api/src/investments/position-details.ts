import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { isValidYmd } from "./ledger/ledger-dates";

import type { InvestmentDetails, InvestmentType } from "@wealthme/contracts";

/** Accept only the type's documented detail fields, never arbitrary JSON. */
export function positionDetails(
  type: InvestmentType,
  raw: Record<string, unknown> | undefined,
): InvestmentDetails {
  const key =
    type === "obligasi"
      ? "bond"
      : type === "emas"
        ? "gold"
        : type === "deposito"
          ? "deposit"
          : type === "lainnya"
            ? "other"
            : null;
  if (!key || !raw?.[key]) return {};
  const value = raw[key];
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new BadRequestException("Detail instrumen tidak valid.");
  const fields: Record<string, string[]> = {
    bond: [
      "instrumentCode",
      "issuer",
      "principal",
      "priceConvention",
      "pricesIncludeAccrued",
      "couponRatePct",
      "couponFrequency",
      "maturityDate",
    ],
    gold: ["form", "unit", "purity", "brand"],
    deposit: ["bankName", "startDate", "maturityDate", "ratePct", "rollover"],
    other: ["unit", "valuationMethod"],
  };
  const source = value as Record<string, unknown>;
  const out: Record<string, string | number | boolean> = {};
  const enums: Record<string, string[]> = {
    priceConvention: ["percent_of_par", "per_unit"],
    form: ["physical", "digital"],
    rollover: ["aro", "aro_plus", "non_aro"],
    valuationMethod: ["manual_price", "fixed_cost"],
  };
  for (const field of fields[key] ?? []) {
    const v = source[field];
    if (v === undefined || v === "") continue;
    if (field === "couponFrequency") {
      if (typeof v !== "number" || ![1, 2, 3, 4, 6, 12].includes(v))
        throw new BadRequestException("Frekuensi kupon tidak valid.");
      out[field] = v;
      continue;
    }
    if (field === "pricesIncludeAccrued") {
      if (typeof v !== "boolean")
        throw new BadRequestException("Konvensi bunga tidak valid.");
      out[field] = v;
      continue;
    }
    if (typeof v !== "string" || v.length > 200)
      throw new BadRequestException("Detail instrumen tidak valid.");
    if (field.endsWith("Date") && !isValidYmd(v))
      throw new BadRequestException("Tanggal instrumen tidak valid.");
    if (
      ["principal", "couponRatePct", "ratePct"].includes(field) &&
      (!/^\d{1,16}(\.\d{1,8})?$/.test(v) ||
        new Prisma.Decimal(v).isNegative() ||
        (field.endsWith("Pct") && new Prisma.Decimal(v).gt(100)))
    )
      throw new BadRequestException("Nilai nominal atau bunga tidak valid.");
    if (enums[field] && !enums[field]!.includes(v))
      throw new BadRequestException("Pilihan detail instrumen tidak valid.");
    out[field] = v.trim();
  }
  if (key === "bond" && out.priceConvention === "percent_of_par")
    out.quantityIsPrincipal = true;
  return { [key]: out } as InvestmentDetails;
}
