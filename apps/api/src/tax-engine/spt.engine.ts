import { ruleAt } from "../tax-rules/tax-rules.registry";

import { daysBetween } from "./dates";

const pad = (n: number) => String(n).padStart(2, "0");

export function sptTiming(taxYear: number, today: string) {
  const filingYear = taxYear + 1;
  const d = ruleAt("filing.sptDeadline", `${filingYear}-01-01`);
  const deadline = `${filingYear}-${pad(d.value.month)}-${pad(d.value.day)}`;
  const g = ruleAt("filing.sptGrace", deadline);
  const graceUntil = g.value.penaltyWaivedUntil;
  const daysToDeadline = daysBetween(today, deadline);
  const pastDeadline = today > deadline;
  return {
    deadline,
    graceUntil,
    daysToDeadline,
    pastDeadline,
    withinGrace: pastDeadline && graceUntil !== null && today <= graceUntil,
    rules: [d.ref, g.ref],
  };
}
