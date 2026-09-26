import { ruleAt } from "../tax-rules/tax-rules.registry";

import { daysBetween, maxDate, minDate } from "./dates";
import { applyBps, divHalfUp } from "./money";

import type {
  FinalRateValue,
  TaxRuleKey,
  TaxRuleRef,
} from "../tax-rules/tax-rule.types";

export const FINAL_INSTRUMENTS = [
  "bunga_deposito",
  "bunga_tabungan",
  "dividen",
  "saham_idx",
  "kupon_sbn",
  "reksa_dana",
  "p2p",
  "kripto_domestik",
  "kripto_luar",
  "emas",
  "sewa",
] as const;
export type FinalInstrument = (typeof FINAL_INSTRUMENTS)[number];

const SIMPLE_KEY: Record<
  Exclude<FinalInstrument, "dividen" | "saham_idx">,
  TaxRuleKey
> = {
  bunga_deposito: "final.depositoInterest",
  bunga_tabungan: "final.savingsInterest",
  kupon_sbn: "final.sbnCoupon",
  reksa_dana: "final.mutualFund",
  p2p: "final.p2p",
  kripto_domestik: "final.cryptoDomestic",
  kripto_luar: "final.cryptoForeign",
  emas: "final.gold",
  sewa: "final.rental",
};

function ruleRate(
  instrument: FinalInstrument,
  date: string,
  reinvested: boolean,
) {
  if (instrument === "dividen") {
    const r = ruleAt("final.dividend", date);
    return {
      rateBps: reinvested ? r.value.reinvestedBps : r.value.notReinvestedBps,
      minPrincipal: null,
      ref: r.ref,
    };
  }
  if (instrument === "saham_idx") {
    const r = ruleAt("final.idxShareSale", date);
    return { rateBps: r.value.rateBps, minPrincipal: null, ref: r.ref };
  }
  const r = ruleAt(SIMPLE_KEY[instrument], date) as {
    value: FinalRateValue;
    ref: TaxRuleRef;
  };
  return {
    rateBps: r.value.rateBps,
    minPrincipal: r.value.minPrincipal,
    ref: r.ref,
  };
}

export function finalTaxFor(input: {
  instrument: FinalInstrument;
  grossAmount: bigint;
  date: string;
  reinvested?: boolean;
  principal?: bigint | null;
  rateBpsOverride?: number | null;
}) {
  const rule = ruleRate(
    input.instrument,
    input.date,
    input.reinvested === true,
  );
  const override = input.rateBpsOverride ?? null;
  if (
    override !== null &&
    (!Number.isInteger(override) || override < 0 || override > 10_000)
  ) {
    throw new RangeError("rateBpsOverride must be 0..10000");
  }
  const belowThreshold =
    rule.minPrincipal !== null &&
    input.principal != null &&
    input.principal <= rule.minPrincipal;
  const rateBps = override ?? rule.rateBps;
  const rateSource =
    override !== null ? "override" : rule.rateBps === null ? "missing" : "rule";
  const tax =
    rateBps === null
      ? null
      : belowThreshold
        ? 0n
        : applyBps(input.grossAmount, rateBps);
  return { rateBps, tax, rateSource, belowThreshold, ref: rule.ref } as const;
}

export function accruedInterest(args: {
  principal: bigint;
  rateHundredths: bigint;
  from: string;
  to: string | null;
  taxYear: number;
}) {
  const start = maxDate(args.from, `${args.taxYear}-01-01`);
  const end = minDate(
    args.to ?? `${args.taxYear + 1}-01-01`,
    `${args.taxYear + 1}-01-01`,
  );
  const days = Math.max(0, daysBetween(start, end));
  if (days === 0) return { interest: 0n, days: 0 };
  return {
    interest: divHalfUp(
      args.principal * args.rateHundredths * BigInt(days),
      10_000n * 365n,
    ),
    days,
  };
}
