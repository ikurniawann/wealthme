import {
  monthsToPayOff,
  prepaymentPenalty,
  simulatePrepayment,
} from "./prepayment.util";

import type { ScheduleInput } from "./amortisation.util";
import type { RatePlan } from "./rate-plan.util";

const FLOATING_11: RatePlan = {
  segments: [{ kind: "fixed", months: null, ratePercent: "11.00" }],
  floatingChanges: [],
};
// 400 jt left, 180 bln left, 11.00%: installment 4.546.388.
const AT_61: ScheduleInput = {
  method: "anuitas",
  remainingBalance: 400_000_000n,
  originalPrincipal: 500_000_000n,
  annualInterestRatePercent: "11.00",
  installmentAmount: 4_546_388n,
  remainingMonths: 180,
  firstPeriod: 61,
  fixedRateMonths: null,
  floatingRatePercent: null,
  ratePlan: FLOATING_11,
};
const BERJENJANG: RatePlan = {
  segments: [
    { kind: "fixed", months: 24, ratePercent: "3.50" },
    { kind: "fixed", months: 12, ratePercent: "5.50" },
    { kind: "floating", months: null, ratePercent: "11.00" },
  ],
  floatingChanges: [],
};
const BERJENJANG_AT_13: ScheduleInput = {
  ...AT_61,
  remainingBalance: 482_422_215n,
  annualInterestRatePercent: "3.50",
  installmentAmount: 2_899_799n,
  remainingMonths: 228,
  firstPeriod: 13,
  ratePlan: BERJENJANG,
};

describe("prepaymentPenalty — revisi K", () => {
  it("rounds half up to the rupiah", () => {
    expect(prepaymentPenalty(12_345_650n, "1.00")).toBe(123_457n);
    expect(prepaymentPenalty(12_345_649n, "1.00")).toBe(123_456n);
    expect(prepaymentPenalty(33_333_333n, "1.25")).toBe(416_667n);
    expect(prepaymentPenalty(100_000_000n, "0")).toBe(0n);
  });
});

describe("monthsToPayOff — revisi K", () => {
  it("300 jt at 11.00% with 4.546.388/bln takes 102 months; an installment below interest never pays off", () => {
    expect(monthsToPayOff(300_000_000n, "11.00", 4_546_388n)).toBe(102);
    expect(monthsToPayOff(300_000_000n, "11.00", 2_750_000n)).toBeNull();
  });
});

describe("simulatePrepayment — revisi K golden numbers", () => {
  it("partial 100 jt, reduce installment: 4.546.388 -> 3.409.791, tenor kept", () => {
    const r = simulatePrepayment({
      schedule: AT_61,
      mode: "reduce_installment",
      amount: 100_000_000n,
      penaltyPercent: "1.00",
    });
    expect(r).toEqual({
      mode: "reduce_installment",
      prepaidPrincipal: 100_000_000n,
      penalty: 1_000_000n,
      cashOutNow: 101_000_000n,
      installmentBefore: 4_546_388n,
      installmentAfter: 3_409_791n,
      remainingMonthsBefore: 180,
      remainingMonthsAfter: 180,
      totalInterestBefore: 418_349_734n,
      totalInterestAfter: 313_762_283n,
      interestSaved: 104_587_451n,
      netSaving: 103_587_451n,
      newInstallmentAmount: 3_409_791n,
      newTenorMonths: null,
    });
  });

  it("partial 100 jt, reduce tenor: installment kept, 180 -> 102 months", () => {
    const r = simulatePrepayment({
      schedule: AT_61,
      mode: "reduce_tenor",
      amount: 100_000_000n,
      penaltyPercent: "1.00",
    });
    expect(r.installmentAfter).toBe(4_546_388n);
    expect(r.remainingMonthsAfter).toBe(102);
    expect(r.totalInterestAfter).toBe(162_646_456n);
    expect(r.interestSaved).toBe(255_703_278n);
    expect(r.netSaving).toBe(254_703_278n);
    // Persisted: installment kept from #61, tenor 60 + 102 = 162.
    expect(r.newInstallmentAmount).toBe(4_546_388n);
    expect(r.newTenorMonths).toBe(162);
  });

  it("full payoff: penalty on the whole balance, every future interest rupiah saved", () => {
    const r = simulatePrepayment({
      schedule: AT_61,
      mode: "full",
      amount: 0n,
      penaltyPercent: "2.50",
    });
    expect(r.prepaidPrincipal).toBe(400_000_000n);
    expect(r.penalty).toBe(10_000_000n);
    expect(r.cashOutNow).toBe(410_000_000n);
    expect(r.installmentAfter).toBeNull();
    expect(r.remainingMonthsAfter).toBe(0);
    expect(r.interestSaved).toBe(418_349_734n);
    expect(r.newInstallmentAmount).toBeNull();
    expect(r.newTenorMonths).toBeNull();
  });

  it("partial equal to the balance is reported as full", () => {
    expect(
      simulatePrepayment({
        schedule: AT_61,
        mode: "reduce_tenor",
        amount: 400_000_000n,
        penaltyPercent: "1.00",
      }).mode,
    ).toBe("full");
  });

  it("berjenjang at 13, 50 jt reduce tenor: 196 months, still steps up at 25 and 37", () => {
    const r = simulatePrepayment({
      schedule: BERJENJANG_AT_13,
      mode: "reduce_tenor",
      amount: 50_000_000n,
      penaltyPercent: "1.00",
    });
    expect(r.penalty).toBe(500_000n);
    expect(r.installmentAfter).toBe(2_899_799n);
    expect(r.remainingMonthsAfter).toBe(196);
    expect(r.interestSaved).toBe(158_148_844n);
    expect(r.newTenorMonths).toBe(208);
  });

  it("berjenjang at 13, 50 jt reduce installment: 2.599.253 now", () => {
    const r = simulatePrepayment({
      schedule: BERJENJANG_AT_13,
      mode: "reduce_installment",
      amount: 50_000_000n,
      penaltyPercent: "1.00",
    });
    expect(r.installmentAfter).toBe(2_599_253n);
    expect(r.remainingMonthsAfter).toBe(228);
    expect(r.interestSaved).toBe(60_788_997n);
  });

  it("rejects 0 and more than the balance", () => {
    expect(() =>
      simulatePrepayment({
        schedule: AT_61,
        mode: "reduce_tenor",
        amount: 0n,
        penaltyPercent: "1.00",
      }),
    ).toThrow(RangeError);
    expect(() =>
      simulatePrepayment({
        schedule: AT_61,
        mode: "reduce_tenor",
        amount: 400_000_001n,
        penaltyPercent: "1.00",
      }),
    ).toThrow(RangeError);
  });
});
