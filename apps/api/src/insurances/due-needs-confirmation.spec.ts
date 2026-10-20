import { Prisma } from "@prisma/client";

import { buildInsuranceSummary } from "./insurance-summary";
import {
  dueNeedsConfirmation,
  lastPaidDueByPolicy,
  parseDateOnly,
} from "./premium-schedule.util";

type Period = "monthly" | "yearly" | "single";

describe("dueNeedsConfirmation", () => {
  const today = parseDateOnly("2026-10-20");
  const flag = (due: string | null, period: Period, lastPaid?: string) =>
    dueNeedsConfirmation(
      {
        nextPremiumDueDate: due ? parseDateOnly(due) : null,
        premiumPeriod: period,
        coverageStartDate: parseDateOnly("2024-01-15"),
        premiumPaymentEndDate: null,
      },
      today,
      lastPaid ? parseDateOnly(lastPaid) : null,
    );

  it("flags a legacy coverage-end date on a monthly policy", () => {
    expect(flag("2036-10-20", "monthly")).toBe(true);
  });

  it("keeps a plausible next due without any payment", () => {
    expect(flag("2026-11-15", "monthly")).toBe(false);
    expect(flag("2026-11-27", "monthly")).toBe(false);
    expect(flag("2026-10-01", "monthly")).toBe(false);
    expect(flag("2027-11-19", "yearly")).toBe(false);
  });

  it("does not flag a due an early payment advanced one period ahead", () => {
    // Due 2026-11-15 paid early on 2026-10-20: pay() moved it to 2026-12-15,
    // past the 2026-11-27 period limit.
    expect(flag("2026-12-15", "monthly", "2026-11-15")).toBe(false);
  });

  it("flags that due again once the payment is voided (no payment left)", () => {
    expect(flag("2026-12-15", "monthly")).toBe(true);
  });

  it("still flags a legacy due when the paid due does not step onto it", () => {
    // Paying an older scheduled due never moves a 2036 legacy due.
    expect(flag("2036-10-20", "monthly", "2026-10-20")).toBe(true);
    expect(flag("2026-12-15", "monthly", "2026-10-15")).toBe(true);
  });

  it("uses 13 months for single/custom periods and ignores missing dues", () => {
    expect(flag("2027-11-19", "single")).toBe(false);
    expect(flag("2027-11-21", "single")).toBe(true);
    expect(flag("2027-11-21", "single", "2026-10-20")).toBe(true);
    expect(flag(null, "monthly")).toBe(false);
  });
});

describe("lastPaidDueByPolicy", () => {
  it("keeps the latest dated due per policy and skips undated payments", () => {
    const map = lastPaidDueByPolicy([
      { insuranceId: "a", dueDate: parseDateOnly("2026-10-15") },
      { insuranceId: "a", dueDate: parseDateOnly("2026-11-15") },
      { insuranceId: "a", dueDate: null },
      { insuranceId: "b", dueDate: null },
    ]);
    expect(map.get("a")?.toISOString().slice(0, 10)).toBe("2026-11-15");
    expect(map.has("b")).toBe(false);
  });
});

describe("buildInsuranceSummary — dues advanced by a payment", () => {
  const today = parseDateOnly("2026-10-20");
  const row = {
    id: "axa",
    status: "aktif",
    premiumAmount: BigInt(1_000_000),
    premiumPeriod: "monthly",
    nextPremiumDueDate: parseDateOnly("2026-12-15"),
    coverageStartDate: parseDateOnly("2024-01-15"),
    premiumPaymentEndDate: null,
    benefits: [],
    valuations: [],
  } as unknown as Parameters<typeof buildInsuranceSummary>[0][number];
  const summarize = (lastPaidDue: Map<string, Date>) =>
    buildInsuranceSummary([row], {
      today,
      from: parseDateOnly("2026-12-01"),
      to: parseDateOnly("2026-12-31"),
      netWorthValueIdr: 0n,
      lastPaidDue,
    });

  it("totals the advanced due when a payment produced it", () => {
    const s = summarize(new Map([["axa", parseDateOnly("2026-11-15")]]));
    expect(s.dueNeedsConfirmationCount).toBe(0);
    expect(s.premiumDue).toEqual([
      {
        currency: "IDR",
        total: new Prisma.Decimal(1_000_000).toFixed(2),
        count: 1,
      },
    ]);
  });

  it("excludes it again without the payment (voided)", () => {
    const s = summarize(new Map());
    expect(s.dueNeedsConfirmationCount).toBe(1);
    expect(s.premiumDue).toEqual([]);
  });
});
