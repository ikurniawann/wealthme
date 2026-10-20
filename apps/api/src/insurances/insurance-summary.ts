import { Prisma } from "@prisma/client";

import { PREMIUM_PAYING_STATUSES } from "./insurance-reminders.service";
import {
  DEFAULT_TIME_ZONE,
  dueNeedsConfirmation,
  duesInRange,
  monthlyEquivalent,
  scheduleOptionsFor,
  ymd,
} from "./premium-schedule.util";
import { confirmedPolicyValue } from "./value/insurance-value.core";

import type { InsuranceSummaryResponseDto } from "./dto/insurance-response.dto";
import type {
  InsuranceBenefitGroupDto,
  InsuranceConfirmedValueDto,
  InsuranceCurrencyTotalDto,
} from "@wealthme/contracts";

type Dec = Prisma.Decimal;
const D = Prisma.Decimal;

/**
 * Controller ruling (Task 22 review): `premiumAmount` is STORED IN IDR — the
 * FX layer (FX_FIELD_SPECS.insurance) converts foreign input before it is
 * saved and pay() debits IDR. The policy's `currency` is only a label, so
 * premiums are grouped and totalled under IDR, never under the label.
 */
const PREMIUM_CURRENCY = "IDR";

type SummaryRow = Prisma.InsuranceGetPayload<{
  include: { benefits: true; valuations: true };
}>;

/** Sum per currency — money in different currencies is never added together. */
class CurrencyTotals {
  private readonly map = new Map<string, { total: Dec; count: number }>();

  add(currency: string, amount: Dec, count = 1): void {
    const cur = this.map.get(currency) ?? { total: new D(0), count: 0 };
    this.map.set(currency, {
      total: cur.total.plus(amount),
      count: cur.count + count,
    });
  }

  get(currency: string): Dec | null {
    return this.map.get(currency)?.total ?? null;
  }

  list(dp: number): InsuranceCurrencyTotalDto[] {
    return [...this.map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, { total, count }]) => ({
        currency,
        total: total.toDecimalPlaces(dp, D.ROUND_HALF_UP).toFixed(dp),
        count,
      }));
  }
}

/**
 * Asuransi Task 22 — the /insurances/summary figures (spec §2), computed
 * from the premium schedule (S1) and confirmed values (S5/S6):
 * - activePolicies: status aktif or masa_tenggang (premiums still due);
 * - premiumDue: every scheduled due in [from, to] (IDR — see
 *   PREMIUM_CURRENCY);
 * - overdue: dues from nextPremiumDueDate up to yesterday (IDR);
 * - premiumDue/overdue skip a due that needs confirmation (legacy date that
 *   looks like a coverage end — see dueNeedsConfirmation; `lastPaidDue`
 *   holds each policy's latest paid dueDate, so a due an early payment
 *   advanced is still totalled);
 * - monthlyPremiumNormalized: Decimal per currency, rounded once — a
 *   NORMALIZATION, not a bill (fixes the old per-row integer truncation of
 *   quarterly/yearly premiums and the mixed-currency sum);
 * - benefitGroups: per kind + currency, never one "total protection";
 * - confirmedValues: confirmed policy value with date and source.
 */
export function buildInsuranceSummary(
  rows: SummaryRow[],
  opts: {
    today: Date;
    from?: Date;
    to?: Date;
    netWorthValueIdr: bigint;
    lastPaidDue: ReadonlyMap<string, Date>;
  },
): InsuranceSummaryResponseDto {
  const { today } = opts;
  const from =
    opts.from ??
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const to =
    opts.to ??
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
  const yesterday = new Date(today.getTime() - 86_400_000);

  const paying = rows.filter((r) => PREMIUM_PAYING_STATUSES.includes(r.status));
  const due = new CurrencyTotals();
  const overdue = new CurrencyTotals();
  const monthly = new CurrencyTotals();
  let needsConfirmation = 0;

  for (const r of paying) {
    const premium = new D(r.premiumAmount.toString());
    const m = monthlyEquivalent(premium, r.premiumPeriod);
    if (m) monthly.add(PREMIUM_CURRENCY, m);
    // A legacy due that looks like a coverage end is not a premium due.
    if (dueNeedsConfirmation(r, today, opts.lastPaidDue.get(r.id) ?? null)) {
      needsConfirmation++;
      continue;
    }
    const sched = scheduleOptionsFor(r, r.nextPremiumDueDate);
    const inPeriod = duesInRange(
      r.nextPremiumDueDate,
      r.premiumPeriod,
      from,
      to,
      sched,
    );
    if (inPeriod.length > 0) {
      due.add(
        PREMIUM_CURRENCY,
        premium.times(inPeriod.length),
        inPeriod.length,
      );
    }
    if (r.nextPremiumDueDate && r.nextPremiumDueDate < today) {
      const missed = duesInRange(
        r.nextPremiumDueDate,
        r.premiumPeriod,
        r.nextPremiumDueDate,
        yesterday,
        sched,
      );
      overdue.add(
        PREMIUM_CURRENCY,
        premium.times(missed.length),
        missed.length,
      );
    }
  }

  const idrMonthly = monthly.get("IDR");
  return {
    activePolicies: paying.length,
    totalMonthlyPremium: idrMonthly
      ? idrMonthly.toDecimalPlaces(0, D.ROUND_HALF_UP).toFixed(0)
      : "0",
    currency: "IDR",
    period: { from: ymd(from)!, to: ymd(to)! },
    timeZone: DEFAULT_TIME_ZONE,
    premiumDue: due.list(2),
    overdue: overdue.list(2),
    monthlyPremiumNormalized: monthly
      .list(2)
      .map((t) => ({ ...t, isNormalization: true as const })),
    benefitGroups: benefitGroups(paying),
    confirmedValues: confirmedValues(rows),
    netWorthValueIdr: opts.netWorthValueIdr.toString(),
    dueNeedsConfirmationCount: needsConfirmation,
  };
}

function benefitGroups(rows: SummaryRow[]): InsuranceBenefitGroupDto[] {
  const groups = new Map<
    string,
    InsuranceBenefitGroupDto & { sum: Dec; policies: Set<string> }
  >();
  for (const r of rows) {
    for (const b of r.benefits) {
      if (b.amount === null) continue; // unknown is not zero
      const key = `${b.kind}|${b.currency}`;
      const g = groups.get(key) ?? {
        kind: b.kind,
        currency: b.currency,
        total: "0",
        policyCount: 0,
        hasUnconfirmed: false,
        sum: new D(0),
        policies: new Set<string>(),
      };
      g.sum = g.sum.plus(b.amount);
      g.policies.add(r.id);
      g.hasUnconfirmed ||= !b.confirmed;
      groups.set(key, g);
    }
  }
  return [...groups.values()].map(({ sum, policies, ...g }) => ({
    ...g,
    total: sum.toFixed(2),
    policyCount: policies.size,
  }));
}

function confirmedValues(rows: SummaryRow[]): InsuranceConfirmedValueDto[] {
  return rows.flatMap((r) =>
    confirmedPolicyValue(r.valuations).map((c) => ({
      insuranceId: r.id,
      name: r.name,
      currency: c.currency,
      value: c.value.toString(),
      effectiveDate: ymd(c.effectiveDate)!,
      source: c.source as InsuranceConfirmedValueDto["source"],
      fundId: c.fundId,
      includeInNetWorth: r.includeInNetWorth,
    })),
  );
}
