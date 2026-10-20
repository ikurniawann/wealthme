import { NO_CHANGE, ownerName, searchText } from "./overview-model";

import type { BuiltRow, RowContext } from "./overview-model";
import type { InsuranceNetWorthPosition } from "../../insurances/value/insurance-net-worth.service";

/**
 * Asuransi S6 — one overview row per policy from the SHARED insurance
 * net-worth helper (the same figure the dashboard and balance sheet sum):
 * only the confirmed value of policies with includeInNetWorth=true, counted
 * once. Sum assured and premiums paid never appear here. A foreign value
 * without an FX rate is shown as unpriced and NOT counted (the dashboard
 * leaves it out too), never as zero.
 */
export function insuranceRow(
  p: InsuranceNetWorthPosition,
  ctx: RowContext,
): BuiltRow {
  const value = p.valueIdr === null ? null : p.valueIdr.toString();
  return {
    counted: value !== null,
    search: searchText(p.name, p.provider, p.policyNumber),
    dto: {
      id: `insurances:${p.insuranceId}`,
      name: p.name,
      internalCode: p.policyNumber,
      ticker: null,
      class: "polis_asuransi",
      subtype: p.policyType ?? "polis",
      sourceModule: "insurances",
      sourceId: p.insuranceId,
      sources: [
        {
          module: "insurances",
          id: p.insuranceId,
          href: `/asuransi/${p.insuranceId}`,
        },
      ],
      ownerUserId: p.holderUserId,
      ownerName: ownerName(ctx, p.holderUserId),
      custodian: p.provider,
      platformAccountId: null,
      quantity: null,
      unit: null,
      // The value date of the confirmed statement, not a purchase date.
      acquisition: { date: null, multiple: false },
      status: "active",
      valuationBasis: value === null ? "unpriced" : "manual",
      valueIdr: value,
      displayValue: ctx.display(value),
      displayCurrency: ctx.displayCurrency,
      netWorthValueIdr: value ?? "0",
      costBasisIdr: null,
      price: null,
      change: NO_CHANGE,
      unrealizedPnlIdr: null,
      unrealizedPnlPercent: null,
      duplicateWarning: false,
    },
  };
}
