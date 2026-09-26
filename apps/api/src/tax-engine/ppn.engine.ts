import { ruleAt } from "../tax-rules/tax-rules.registry";

import { divHalfUp } from "./money";

export function ppnPreview(input: {
  date: string;
  amount: bigint;
  luxury: boolean;
  priceIncludesPpn: boolean;
}) {
  const { value, ref } = ruleAt("ppn.rate", input.date);
  const { num, den } = input.luxury ? value.luxuryDpp : value.nonLuxuryDpp;
  const nominal = BigInt(value.nominalBps);
  const scale = den * 10_000n;
  const base = input.priceIncludesPpn
    ? divHalfUp(input.amount * scale, scale + num * nominal)
    : input.amount;
  const ppn = input.priceIncludesPpn
    ? input.amount - base
    : divHalfUp(base * num * nominal, scale);
  return {
    priceExcludingPpn: base,
    dpp: divHalfUp(base * num, den),
    ppn,
    totalWithPpn: base + ppn,
    nominalBps: value.nominalBps,
    effectiveBps: Number(divHalfUp(nominal * num, den)),
    rules: [ref],
  };
}
