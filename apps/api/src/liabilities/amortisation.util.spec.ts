import { splitPayment } from "./amortisation.util";

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
