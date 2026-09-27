import {
  buildSchedule,
  computeInstallment,
  currentInstallment,
  defaultInterestMethod,
  dueDateForPeriod,
  dueInstallment,
  dueInstallmentEffectiveAt,
  monthsElapsed,
  parseRateScaledByHundred,
  rateForPeriod,
  splitPayment,
} from "./amortisation.util";

// E2E round 1, bug 2 — the KPR "Jatuh Tempo Berikutnya" date shown on the
// web relies on this being the SAME due-day math `dueInstallment` and
// `dueInstallmentEffectiveAt` already use internally (no duplicated logic).
describe("dueDateForPeriod — E2E round 1 bug 2", () => {
  it("period 1 is one month after the akad date (2026-08-27 akad -> 2026-09-27)", () => {
    const startDate = new Date("2026-08-27T00:00:00.000Z");
    expect(dueDateForPeriod(startDate, 1).toISOString()).toBe(
      "2026-09-27T00:00:00.000Z",
    );
  });

  it("period 2 is two months after the akad date", () => {
    const startDate = new Date("2026-08-27T00:00:00.000Z");
    expect(dueDateForPeriod(startDate, 2).toISOString()).toBe(
      "2026-10-27T00:00:00.000Z",
    );
  });

  it("period 0 is the akad date itself", () => {
    const startDate = new Date("2026-08-27T00:00:00.000Z");
    expect(dueDateForPeriod(startDate, 0).toISOString()).toBe(
      startDate.toISOString(),
    );
  });
});

// fix-round1 — an akad on the 29th-31st overflows into the WRONG month
// when `Date.UTC` is left to roll a nonexistent day forward on its own
// (31 Jan + "1 month" = "31 Feb", which `Date.UTC` turns into 2/3 March,
// skipping February's due date entirely). Clamped to the target month's
// own last day instead, like a bank's "same date, or month-end if
// shorter" contract convention.
describe("dueDateForPeriod — month-end clamp (fix-round1)", () => {
  it("31 Jan (non-leap 2026): period 1 clamps to 28 Feb, period 2 is 31 Mar, period 3 clamps to 30 Apr", () => {
    const startDate = new Date("2026-01-31T00:00:00.000Z");
    expect(dueDateForPeriod(startDate, 1).toISOString()).toBe(
      "2026-02-28T00:00:00.000Z",
    );
    expect(dueDateForPeriod(startDate, 2).toISOString()).toBe(
      "2026-03-31T00:00:00.000Z",
    );
    expect(dueDateForPeriod(startDate, 3).toISOString()).toBe(
      "2026-04-30T00:00:00.000Z",
    );
  });

  it("31 Jan (leap 2024): period 1 clamps to 29 Feb, not 28", () => {
    const startDate = new Date("2024-01-31T00:00:00.000Z");
    expect(dueDateForPeriod(startDate, 1).toISOString()).toBe(
      "2024-02-29T00:00:00.000Z",
    );
  });

  it("29 Jan (leap 2024): period 1 lands exactly on 29 Feb, no clamp needed", () => {
    const startDate = new Date("2024-01-29T00:00:00.000Z");
    expect(dueDateForPeriod(startDate, 1).toISOString()).toBe(
      "2024-02-29T00:00:00.000Z",
    );
  });

  it("29 Jan (non-leap 2023): period 1 clamps to 28 Feb", () => {
    const startDate = new Date("2023-01-29T00:00:00.000Z");
    expect(dueDateForPeriod(startDate, 1).toISOString()).toBe(
      "2023-02-28T00:00:00.000Z",
    );
  });

  it("31 Aug: period 1 clamps to 30 Sep (never skips into October)", () => {
    const startDate = new Date("2026-08-31T00:00:00.000Z");
    expect(dueDateForPeriod(startDate, 1).toISOString()).toBe(
      "2026-09-30T00:00:00.000Z",
    );
    expect(dueDateForPeriod(startDate, 2).toISOString()).toBe(
      "2026-10-31T00:00:00.000Z",
    );
  });
});

describe("monthsElapsed — agrees with the clamped dueDateForPeriod (fix-round1)", () => {
  it("31 Jan akad: elapsed is 0 the day before the clamped 28 Feb due date", () => {
    const start = new Date("2026-01-31T00:00:00.000Z");
    expect(monthsElapsed(start, new Date("2026-02-27T00:00:00.000Z"))).toBe(0);
  });

  it("31 Jan akad: elapsed becomes 1 exactly on the clamped 28 Feb due date", () => {
    const start = new Date("2026-01-31T00:00:00.000Z");
    expect(monthsElapsed(start, new Date("2026-02-28T00:00:00.000Z"))).toBe(1);
  });

  it("31 Jan akad: elapsed stays 1 through March until the 31 Mar due date", () => {
    const start = new Date("2026-01-31T00:00:00.000Z");
    expect(monthsElapsed(start, new Date("2026-03-30T00:00:00.000Z"))).toBe(1);
    expect(monthsElapsed(start, new Date("2026-03-31T00:00:00.000Z"))).toBe(2);
  });
});

describe("dueInstallment — grace window across a clamped month (fix-round1)", () => {
  it("31 Jan akad, 2 days after the clamped 28 Feb due date: still #1, still in grace", () => {
    const result = dueInstallment(
      new Date("2026-01-31T00:00:00.000Z"),
      new Date("2026-03-02T00:00:00.000Z"),
      240,
    );
    expect(result).toEqual({ period: 1, late: true });
  });

  it("31 Jan akad, exactly on the clamped 28 Feb due date: #1, not late", () => {
    const result = dueInstallment(
      new Date("2026-01-31T00:00:00.000Z"),
      new Date("2026-02-28T00:00:00.000Z"),
      240,
    );
    expect(result).toEqual({ period: 1, late: false });
  });

  it("31 Jan akad, 6 days after the clamped 28 Feb due date: grace expired, rolls to #2", () => {
    const result = dueInstallment(
      new Date("2026-01-31T00:00:00.000Z"),
      new Date("2026-03-06T00:00:00.000Z"),
      240,
    );
    expect(result).toEqual({ period: 2, late: false });
  });
});

describe("dueInstallmentEffectiveAt — prepay anchor across a clamped month (fix-round1)", () => {
  it("period 2's effective instant is grace-days after the clamped period-1 due date (28 Feb)", () => {
    const startDate = new Date("2026-01-31T00:00:00.000Z");
    // period 1 due 28 Feb (clamped); effective 6 days later at WIB midnight.
    expect(dueInstallmentEffectiveAt(startDate, 2).toISOString()).toBe(
      new Date(
        Date.UTC(2026, 2, 6, -7, 0, 0), // 28 Feb + 6 days - WIB offset
      ).toISOString(),
    );
  });
});

/**
 * EPIC-023 Task A2 (RED phase) — pins the principal/interest split against a
 * hand-computed amortisation schedule (see epic doc, Definition of Done:
 * "verified against a hand-computed amortisation schedule, not against the
 * implementation's own output"). `./amortisation.util` does not exist yet —
 * this file is expected to fail on import, not merely on assertions.
 *
 * `interest = round-half-up(remainingBalance * monthlyRate)`,
 * `principal = paymentAmount - interest`, `monthlyRate = annualRatePercent / 100 / 12`.
 *
 * IMPORTANT: none of the assertions below check `interest + principal ===
 * paymentAmount` as the primary signal — that identity holds trivially by
 * construction (principal is DEFINED as paymentAmount - interest) and would
 * pass even for a materially wrong interest formula, exactly the failure
 * mode EPIC-022 hit. Every assertion here pins a literal rupiah figure
 * computed independently by hand.
 */
describe("splitPayment (amortisation) — EPIC-023 A2", () => {
  // EPIC-033 p20 — kartu_kredit rates are quoted per month.
  it("uses the rate per month (no /12) when rateIsMonthly is set", () => {
    const result = splitPayment({
      paymentAmount: 1_000_000n,
      remainingBalance: 3_000_000n,
      annualInterestRatePercent: "2",
      rateIsMonthly: true,
    });
    expect(result.interest).toBe(60_000n);
    expect(result.principal).toBe(940_000n);
  });

  describe("golden schedule — 12.00% annual, Rp 5.000.000 fixed instalment, Rp 100.000.000 opening balance", () => {
    // Hand-computed month by month (monthlyRate = 12/100/12 = 0.01):
    //   interest_n = round-half-up(opening_n * 0.01)
    //   principal_n = 5_000_000 - interest_n
    //   closing_n = opening_n - principal_n
    // Months 5 and 6 land exactly on a round-half-up boundary
    // (837,583.96 -> 837,584 and 795,959.80 -> 795,960) — the schedule
    // deliberately runs to month 6 to exercise that boundary.

    it("month 1: interest 1,000,000 / principal 4,000,000 / closing 96,000,000", () => {
      const result = splitPayment({
        paymentAmount: 5_000_000n,
        remainingBalance: 100_000_000n,
        annualInterestRatePercent: "12.00",
      });
      expect(result.interest).toBe(1_000_000n);
      expect(result.principal).toBe(4_000_000n);
      expect(100_000_000n - result.principal).toBe(96_000_000n);
    });

    it("month 2: interest 960,000 / principal 4,040,000 / closing 91,960,000", () => {
      const result = splitPayment({
        paymentAmount: 5_000_000n,
        remainingBalance: 96_000_000n,
        annualInterestRatePercent: "12.00",
      });
      expect(result.interest).toBe(960_000n);
      expect(result.principal).toBe(4_040_000n);
      expect(96_000_000n - result.principal).toBe(91_960_000n);
    });

    it("month 3: interest 919,600 / principal 4,080,400 / closing 87,879,600", () => {
      const result = splitPayment({
        paymentAmount: 5_000_000n,
        remainingBalance: 91_960_000n,
        annualInterestRatePercent: "12.00",
      });
      expect(result.interest).toBe(919_600n);
      expect(result.principal).toBe(4_080_400n);
      expect(91_960_000n - result.principal).toBe(87_879_600n);
    });

    it("month 4: interest 878,796 / principal 4,121,204 / closing 83,758,396", () => {
      const result = splitPayment({
        paymentAmount: 5_000_000n,
        remainingBalance: 87_879_600n,
        annualInterestRatePercent: "12.00",
      });
      expect(result.interest).toBe(878_796n);
      expect(result.principal).toBe(4_121_204n);
      expect(87_879_600n - result.principal).toBe(83_758_396n);
    });

    it("month 5: interest 837,584 (round-half-up of 837,583.96) / principal 4,162,416 / closing 79,595,980", () => {
      const result = splitPayment({
        paymentAmount: 5_000_000n,
        remainingBalance: 83_758_396n,
        annualInterestRatePercent: "12.00",
      });
      expect(result.interest).toBe(837_584n);
      expect(result.principal).toBe(4_162_416n);
      expect(83_758_396n - result.principal).toBe(79_595_980n);
    });

    it("month 6: interest 795,960 (round-half-up of 795,959.80) / principal 4,204,040 / closing 75,391,940", () => {
      const result = splitPayment({
        paymentAmount: 5_000_000n,
        remainingBalance: 79_595_980n,
        annualInterestRatePercent: "12.00",
      });
      expect(result.interest).toBe(795_960n);
      expect(result.principal).toBe(4_204_040n);
      expect(79_595_980n - result.principal).toBe(75_391_940n);
    });
  });

  it("0% annual rate: interest is 0 and principal absorbs the entire payment", () => {
    const result = splitPayment({
      paymentAmount: 5_000_000n,
      remainingBalance: 50_000_000n,
      annualInterestRatePercent: "0",
    });
    expect(result.interest).toBe(0n);
    expect(result.principal).toBe(5_000_000n);
  });

  it("rounds DOWN when the fractional rupiah is below the half-up boundary (33,333,333 @ 7.50%)", () => {
    // monthlyRate = 7.5 / 100 / 12 = 0.00625
    // 33,333,333 * 0.00625 = 208,333.33125 -> rounds down to 208,333
    const result = splitPayment({
      paymentAmount: 1_000_000n,
      remainingBalance: 33_333_333n,
      annualInterestRatePercent: "7.50",
    });
    expect(result.interest).toBe(208_333n);
  });

  it("caps interest at the payment amount when the payment is smaller than the interest due (principal never negative)", () => {
    // Interest due would be 100,000,000 * 0.01 = 1,000,000, but only
    // 500,000 was paid — interest cannot exceed the payment itself, and
    // principal must never go negative.
    const result = splitPayment({
      paymentAmount: 500_000n,
      remainingBalance: 100_000_000n,
      annualInterestRatePercent: "12.00",
    });
    expect(result.interest).toBe(500_000n);
    expect(result.principal).toBe(0n);
  });

  it("caps principal at the remaining balance so the balance can never go negative", () => {
    // Interest = 1,000,000 * 0.01 = 10,000. An uncapped principal
    // (5,000,000 - 10,000 = 4,990,000) would drive the balance to
    // -3,990,000 — principal must be capped at the 1,000,000 remaining
    // balance instead.
    const result = splitPayment({
      paymentAmount: 5_000_000n,
      remainingBalance: 1_000_000n,
      annualInterestRatePercent: "12.00",
    });
    expect(result.interest).toBe(10_000n);
    expect(result.principal).toBe(1_000_000n);
  });
});

describe("computeInstallment — revisi G", () => {
  it("anuitas: KPR Rp 500 jt @ 8%/yr over 240 bln -> Rp 4.182.200/bln", () => {
    // Hand check: r = 0.08/12 = 0.0066667, (1+r)^240 = 4.926803, A = 500e6 × r × 4.926803 / 3.926803 = 4,182,200.34.
    expect(
      computeInstallment({
        method: "anuitas",
        principal: 500_000_000n,
        annualInterestRatePercent: "8.00",
        tenorMonths: 240,
      }),
    ).toBe(4_182_200n);
  });

  it("flat: kendaraan Rp 200 jt @ 6%/yr flat over 36 bln -> Rp 6.555.556/bln", () => {
    // Hand check: interest 200e6 × 6% / 12 = 1,000,000; principal 200e6 / 36 = 5,555,555.56; sum 6,555,555.56.
    expect(
      computeInstallment({
        method: "flat",
        principal: 200_000_000n,
        annualInterestRatePercent: "6",
        tenorMonths: 36,
      }),
    ).toBe(6_555_556n);
  });

  it("efektif: first month = principal/tenor + interest on the full principal", () => {
    // 120e6 / 12 = 10,000,000 principal; 120e6 × 1% = 1,200,000 interest.
    expect(
      computeInstallment({
        method: "efektif",
        principal: 120_000_000n,
        annualInterestRatePercent: "12",
        tenorMonths: 12,
      }),
    ).toBe(11_200_000n);
  });

  it("anuitas at 0%: principal / tenor, no division by zero", () => {
    expect(
      computeInstallment({
        method: "anuitas",
        principal: 120_000_000n,
        annualInterestRatePercent: "0",
        tenorMonths: 12,
      }),
    ).toBe(10_000_000n);
  });

  it("anuitas with a per-month rate (rateIsMonthly) skips the /12", () => {
    // r = 1%/month, n = 12: A = 12e6 × 0.01 × 1.01^12 / (1.01^12 − 1) = 1,066,185.46.
    expect(
      computeInstallment({
        method: "anuitas",
        principal: 12_000_000n,
        annualInterestRatePercent: "1",
        tenorMonths: 12,
        rateIsMonthly: true,
      }),
    ).toBe(1_066_185n);
  });

  it("returns 0 for a zero principal", () => {
    expect(
      computeInstallment({
        method: "flat",
        principal: 0n,
        annualInterestRatePercent: "6",
        tenorMonths: 36,
      }),
    ).toBe(0n);
  });

  it.each([0, -1, 1.5])("rejects tenorMonths %p", (tenorMonths) => {
    expect(() =>
      computeInstallment({
        method: "anuitas",
        principal: 1_000_000n,
        annualInterestRatePercent: "8",
        tenorMonths,
      }),
    ).toThrow(RangeError);
  });
});

describe("splitPayment per interest method — revisi G", () => {
  it("kartu kredit: Rp 10 jt outstanding @ 2.25%/bln -> interest Rp 225.000", () => {
    const result = splitPayment({
      paymentAmount: 500_000n,
      remainingBalance: 10_000_000n,
      annualInterestRatePercent: "2.25",
      rateIsMonthly: true,
    });
    expect(result.interest).toBe(225_000n);
    expect(result.principal).toBe(275_000n);
  });

  it("flat: interest is on the ORIGINAL principal, not the remaining balance", () => {
    // 200e6 × 6% / 12 = 1,000,000 (efektif on the 150e6 balance would be 750,000).
    const result = splitPayment({
      method: "flat",
      originalPrincipal: 200_000_000n,
      paymentAmount: 6_555_556n,
      remainingBalance: 150_000_000n,
      annualInterestRatePercent: "6.00",
    });
    expect(result.interest).toBe(1_000_000n);
    expect(result.principal).toBe(5_555_556n);
  });

  it("flat: no interest once the balance is 0", () => {
    const result = splitPayment({
      method: "flat",
      originalPrincipal: 200_000_000n,
      paymentAmount: 1_000_000n,
      remainingBalance: 0n,
      annualInterestRatePercent: "6.00",
    });
    expect(result.interest).toBe(0n);
    expect(result.principal).toBe(0n);
  });

  it("flat without originalPrincipal is a programming error", () => {
    expect(() =>
      splitPayment({
        method: "flat",
        paymentAmount: 1_000_000n,
        remainingBalance: 1_000_000n,
        annualInterestRatePercent: "6",
      }),
    ).toThrow("flat interest needs originalPrincipal");
  });

  it("anuitas: month 1 of the KPR 500 jt / 8% / 240 schedule", () => {
    // 500e6 × 0.08 / 12 = 3,333,333.33 -> 3,333,333; principal 4,182,200 − 3,333,333.
    const result = splitPayment({
      method: "anuitas",
      paymentAmount: 4_182_200n,
      remainingBalance: 500_000_000n,
      annualInterestRatePercent: "8.00",
    });
    expect(result.interest).toBe(3_333_333n);
    expect(result.principal).toBe(848_867n);
  });
});

describe("defaultInterestMethod — revisi G", () => {
  it.each([
    ["kpr", "anuitas"],
    ["kendaraan", "flat"],
    ["pinjaman_pribadi", "flat"],
    ["kartu_kredit", "efektif"],
    ["lainnya", "efektif"],
  ])("%s -> %s", (type, method) => {
    expect(defaultInterestMethod(type)).toBe(method);
  });
});

describe("rateForPeriod / monthsElapsed — revisi G", () => {
  const kpr = {
    baseRatePercent: "8.00",
    fixedRateMonths: 36,
    floatingRatePercent: "11.00",
  };

  it("uses the fixed rate through the last fixed month and the floating rate after", () => {
    expect(rateForPeriod({ ...kpr, period: 36 })).toBe("8.00");
    expect(rateForPeriod({ ...kpr, period: 37 })).toBe("11.00");
  });

  it("stays on the base rate when no floating rate is set", () => {
    expect(
      rateForPeriod({ ...kpr, floatingRatePercent: null, period: 100 }),
    ).toBe("8.00");
  });

  it("counts whole months, minus one when the day of month has not come yet", () => {
    const start = new Date("2025-09-10T00:00:00.000Z");
    expect(monthsElapsed(start, new Date("2026-09-25T00:00:00.000Z"))).toBe(12);
    expect(monthsElapsed(start, new Date("2026-09-05T00:00:00.000Z"))).toBe(11);
    expect(monthsElapsed(start, start)).toBe(0);
  });

  it("monthsElapsed never goes negative for a future start date", () => {
    expect(
      monthsElapsed(
        new Date("2027-01-01T00:00:00.000Z"),
        new Date("2026-09-25T00:00:00.000Z"),
      ),
    ).toBe(0);
  });
});

describe("buildSchedule — revisi G golden schedules", () => {
  const NO_FLOAT = { fixedRateMonths: null, floatingRatePercent: null };

  it("anuitas: KPR 500 jt / 8% / 240 bln, fixed installment 4.182.200, pays off exactly", () => {
    const rows = buildSchedule({
      method: "anuitas",
      remainingBalance: 500_000_000n,
      originalPrincipal: 500_000_000n,
      annualInterestRatePercent: "8.00",
      installmentAmount: 4_182_200n,
      remainingMonths: 240,
      firstPeriod: 1,
      ...NO_FLOAT,
    });
    expect(rows).toHaveLength(240);
    expect(rows[0]).toEqual({
      period: 1,
      installment: 4_182_200n,
      interest: 3_333_333n,
      principal: 848_867n,
      remaining: 499_151_133n,
    });
    // 499,151,133 × 0.08/12 = 3,327,674.22 -> 3,327,674.
    expect(rows[1]).toEqual({
      period: 2,
      installment: 4_182_200n,
      interest: 3_327_674n,
      principal: 854_526n,
      remaining: 498_296_607n,
    });
    expect(rows[239]).toEqual({
      period: 240,
      installment: 4_182_420n,
      interest: 27_698n,
      principal: 4_154_722n,
      remaining: 0n,
    });
    expect(rows.reduce((sum, r) => sum + r.principal, 0n)).toBe(500_000_000n);
  });

  it("anuitas KPR: fixed 8% for 36 bln, then floating 11% re-amortised over the remaining 204 bln", () => {
    const rows = buildSchedule({
      method: "anuitas",
      remainingBalance: 500_000_000n,
      originalPrincipal: 500_000_000n,
      annualInterestRatePercent: "8.00",
      installmentAmount: 4_182_200n,
      remainingMonths: 240,
      firstPeriod: 1,
      fixedRateMonths: 36,
      floatingRatePercent: "11.00",
    });
    expect(rows).toHaveLength(240);
    expect(rows[35]).toEqual({
      period: 36,
      installment: 4_182_200n,
      interest: 3_111_079n,
      principal: 1_071_121n,
      remaining: 465_590_716n,
    });
    // 465,590,716 × 0.11/12 = 4,267,914.90 -> 4,267,915.
    expect(rows[36]).toEqual({
      period: 37,
      installment: 5_053_432n,
      interest: 4_267_915n,
      principal: 785_517n,
      remaining: 464_805_199n,
    });
    expect(rows[239]?.remaining).toBe(0n);
  });

  it("anuitas mid-life: continues from period 13 with the current balance", () => {
    const rows = buildSchedule({
      method: "anuitas",
      remainingBalance: 489_431_673n,
      originalPrincipal: 500_000_000n,
      annualInterestRatePercent: "8.00",
      installmentAmount: 4_182_200n,
      remainingMonths: 228,
      firstPeriod: 13,
      ...NO_FLOAT,
    });
    expect(rows).toHaveLength(228);
    expect(rows[0]).toEqual({
      period: 13,
      installment: 4_182_200n,
      interest: 3_262_878n,
      principal: 919_322n,
      remaining: 488_512_351n,
    });
    expect(rows[227]).toEqual({
      period: 240,
      installment: 4_182_420n,
      interest: 27_698n,
      principal: 4_154_722n,
      remaining: 0n,
    });
  });

  it("flat: kendaraan 200 jt / 6% / 36 bln — constant 1.000.000 interest, last row absorbs rounding", () => {
    const rows = buildSchedule({
      method: "flat",
      remainingBalance: 200_000_000n,
      originalPrincipal: 200_000_000n,
      annualInterestRatePercent: "6",
      installmentAmount: 6_555_556n,
      remainingMonths: 36,
      firstPeriod: 1,
      ...NO_FLOAT,
    });
    expect(rows).toHaveLength(36);
    expect(rows[0]).toEqual({
      period: 1,
      installment: 6_555_556n,
      interest: 1_000_000n,
      principal: 5_555_556n,
      remaining: 194_444_444n,
    });
    expect(rows[35]).toEqual({
      period: 36,
      installment: 6_555_540n,
      interest: 1_000_000n,
      principal: 5_555_540n,
      remaining: 0n,
    });
  });

  it("efektif kartu kredit: open-ended, min. bayar 800.000 on 8 jt @ 2.25%/bln", () => {
    const rows = buildSchedule({
      method: "efektif",
      remainingBalance: 8_000_000n,
      originalPrincipal: 30_000_000n,
      annualInterestRatePercent: "2.25",
      rateIsMonthly: true,
      installmentAmount: 800_000n,
      remainingMonths: null,
      firstPeriod: 1,
      ...NO_FLOAT,
    });
    expect(rows).toHaveLength(12);
    expect(rows[0]).toEqual({
      period: 1,
      installment: 800_000n,
      interest: 180_000n,
      principal: 620_000n,
      remaining: 7_380_000n,
    });
    expect(rows[11]).toEqual({
      period: 12,
      installment: 366_622n,
      interest: 8_067n,
      principal: 358_555n,
      remaining: 0n,
    });
  });

  it("efektif with a tenor and no installment: equal principal, declining interest", () => {
    const rows = buildSchedule({
      method: "efektif",
      remainingBalance: 12_000_000n,
      originalPrincipal: 12_000_000n,
      annualInterestRatePercent: "12",
      installmentAmount: null,
      remainingMonths: 12,
      firstPeriod: 1,
      ...NO_FLOAT,
    });
    expect(rows).toHaveLength(12);
    expect(rows[0]).toEqual({
      period: 1,
      installment: 1_120_000n,
      interest: 120_000n,
      principal: 1_000_000n,
      remaining: 11_000_000n,
    });
    expect(rows[11]).toEqual({
      period: 12,
      installment: 1_010_000n,
      interest: 10_000n,
      principal: 1_000_000n,
      remaining: 0n,
    });
  });

  it("stops after one row when the installment does not cover the interest", () => {
    const rows = buildSchedule({
      method: "efektif",
      remainingBalance: 100_000_000n,
      originalPrincipal: 100_000_000n,
      annualInterestRatePercent: "12",
      installmentAmount: 500_000n,
      remainingMonths: null,
      firstPeriod: 1,
      ...NO_FLOAT,
    });
    expect(rows).toEqual([
      {
        period: 1,
        installment: 500_000n,
        interest: 500_000n,
        principal: 0n,
        remaining: 100_000_000n,
      },
    ]);
  });

  it("caps at 600 rows for an open-ended tiny installment", () => {
    const rows = buildSchedule({
      method: "efektif",
      remainingBalance: 1_000_000_000_000n,
      originalPrincipal: 1_000_000_000_000n,
      annualInterestRatePercent: "0",
      installmentAmount: 1n,
      remainingMonths: null,
      firstPeriod: 1,
      ...NO_FLOAT,
    });
    expect(rows).toHaveLength(600);
  });

  it("returns no rows when neither an installment nor a tenor is known", () => {
    expect(
      buildSchedule({
        method: "efektif",
        remainingBalance: 5_000_000n,
        originalPrincipal: 5_000_000n,
        annualInterestRatePercent: "10",
        installmentAmount: null,
        remainingMonths: null,
        firstPeriod: 1,
        ...NO_FLOAT,
      }),
    ).toEqual([]);
  });
});

describe("parseRateScaledByHundred", () => {
  it("treats equal values with different spellings as equal", () => {
    expect(parseRateScaledByHundred("6")).toBe(600n);
    expect(parseRateScaledByHundred("6.00")).toBe(600n);
    expect(parseRateScaledByHundred("6.5")).toBe(650n);
    expect(parseRateScaledByHundred("6.50")).toBe(650n);
  });
});

describe("currentInstallment (final fix 2)", () => {
  // KPR 500 jt / 20 th, 5% fixed for 36 months, then 11% floating.
  const KPR = {
    method: "anuitas" as const,
    originalPrincipal: 500_000_000n,
    annualInterestRatePercent: "5.00",
    fixedRateMonths: 36,
    floatingRatePercent: "11.00",
  };
  const FIXED_INSTALLMENT = computeInstallment({
    method: "anuitas",
    principal: 500_000_000n,
    annualInterestRatePercent: "5.00",
    tenorMonths: 240,
  });

  it("is the contractual installment inside the fixed period", () => {
    expect(
      currentInstallment({
        ...KPR,
        remainingBalance: 480_000_000n,
        installmentAmount: FIXED_INSTALLMENT,
        remainingMonths: 229,
        firstPeriod: 12,
      }),
    ).toBe(FIXED_INSTALLMENT);
  });

  it("is the balance re-amortised at the floating rate once the fixed period ends", () => {
    const input = {
      ...KPR,
      remainingBalance: 450_000_000n,
      installmentAmount: FIXED_INSTALLMENT,
      remainingMonths: 204,
      firstPeriod: 37,
    };
    const expected = computeInstallment({
      method: "anuitas",
      principal: 450_000_000n,
      annualInterestRatePercent: "11.00",
      tenorMonths: 204,
    });

    expect(currentInstallment(input)).toBe(expected);
    expect(expected).toBeGreaterThan((450_000_000n * 1100n) / 120_000n);
    expect(expected).toBeGreaterThan(FIXED_INSTALLMENT);
    expect(buildSchedule(input)[0]?.installment).toBe(expected);
  });

  it("is null when nothing is scheduled (no installment, no tenor)", () => {
    expect(
      currentInstallment({
        method: "efektif",
        remainingBalance: 5_000_000n,
        originalPrincipal: 5_000_000n,
        annualInterestRatePercent: "10.00",
        installmentAmount: null,
        remainingMonths: null,
        firstPeriod: 1,
        fixedRateMonths: null,
        floatingRatePercent: null,
      }),
    ).toBeNull();
  });
});
