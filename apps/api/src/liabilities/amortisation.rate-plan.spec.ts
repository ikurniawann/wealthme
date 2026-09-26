import {
  buildSchedule,
  computeInstallment,
  currentInstallment,
} from "./amortisation.util";

import type { RatePlan } from "./rate-plan.util";

const BERJENJANG: RatePlan = {
  segments: [
    { kind: "fixed", months: 24, ratePercent: "3.50" },
    { kind: "fixed", months: 12, ratePercent: "5.50" },
    { kind: "floating", months: null, ratePercent: "11.00" },
  ],
  floatingChanges: [],
};
const LEGACY_OFF = { fixedRateMonths: null, floatingRatePercent: null };
const KPR_500 = {
  method: "anuitas" as const,
  remainingBalance: 500_000_000n,
  originalPrincipal: 500_000_000n,
  annualInterestRatePercent: "3.50",
  installmentAmount: 2_899_799n,
  remainingMonths: 240,
  firstPeriod: 1,
  ...LEGACY_OFF,
};

describe("buildSchedule over a rate plan — revisi K golden schedules", () => {
  it("berjenjang 500 jt / 240 bln: re-annuitises at 25 and 37, pays off exactly", () => {
    expect(
      computeInstallment({
        method: "anuitas",
        principal: 500_000_000n,
        annualInterestRatePercent: "3.50",
        tenorMonths: 240,
      }),
    ).toBe(2_899_799n);
    const rows = buildSchedule({ ...KPR_500, ratePlan: BERJENJANG });
    expect(rows).toHaveLength(240);
    expect(rows[0]).toEqual({
      period: 1,
      installment: 2_899_799n,
      interest: 1_458_333n,
      principal: 1_441_466n,
      remaining: 498_558_534n,
    });
    expect(rows[23]).toEqual({
      period: 24,
      installment: 2_899_799n,
      interest: 1_358_468n,
      principal: 1_541_331n,
      remaining: 464_219_240n,
    });
    expect(rows[24]).toEqual({
      period: 25,
      installment: 3_390_269n,
      interest: 2_127_672n,
      principal: 1_262_597n,
      remaining: 462_956_643n,
    });
    expect(rows[35]).toEqual({
      period: 36,
      installment: 3_390_269n,
      interest: 2_062_537n,
      principal: 1_327_732n,
      remaining: 448_680_240n,
    });
    expect(rows[36]).toEqual({
      period: 37,
      installment: 4_869_888n,
      interest: 4_112_902n,
      principal: 756_986n,
      remaining: 447_923_254n,
    });
    expect(rows[239]).toEqual({
      period: 240,
      installment: 4_870_149n,
      interest: 44_238n,
      principal: 4_825_911n,
      remaining: 0n,
    });
    expect(rows.reduce((s, r) => s + r.principal, 0n)).toBe(500_000_000n);
  });

  it("mid-tier start (period 30) re-annuitises the current balance at tier 2", () => {
    const rows = buildSchedule({
      ...KPR_500,
      remainingBalance: 457_848_118n,
      remainingMonths: 211,
      firstPeriod: 30,
      ratePlan: BERJENJANG,
    });
    expect(rows[0]).toEqual({
      period: 30,
      installment: 3_390_269n,
      interest: 2_098_471n,
      principal: 1_291_798n,
      remaining: 456_556_320n,
    });
    expect(rows[7]?.installment).toBe(4_869_888n);
    expect(rows).toHaveLength(211);
  });

  it("recorded floating change at 61 re-annuitises there; 60 keeps the seeded rate", () => {
    const rows = buildSchedule({
      ...KPR_500,
      ratePlan: {
        ...BERJENJANG,
        floatingChanges: [{ effectivePeriod: 61, ratePercent: "9.75" }],
      },
    });
    expect(rows[59]).toEqual({
      period: 60,
      installment: 4_869_888n,
      interest: 3_936_130n,
      principal: 933_758n,
      remaining: 428_462_235n,
    });
    expect(rows[60]).toEqual({
      period: 61,
      installment: 4_538_969n,
      interest: 3_481_256n,
      principal: 1_057_713n,
      remaining: 427_404_522n,
    });
    expect(rows[239]).toEqual({
      period: 240,
      installment: 4_538_946n,
      interest: 36_582n,
      principal: 4_502_364n,
      remaining: 0n,
    });
  });

  it("mid-month change (effective period 62): 61 still at 11.00", () => {
    const rows = buildSchedule({
      ...KPR_500,
      ratePlan: {
        ...BERJENJANG,
        floatingChanges: [{ effectivePeriod: 62, ratePercent: "9.75" }],
      },
    });
    expect(rows[60]).toEqual({
      period: 61,
      installment: 4_869_888n,
      interest: 3_927_570n,
      principal: 942_318n,
      remaining: 427_519_917n,
    });
    expect(rows[61]).toEqual({
      period: 62,
      installment: 4_540_194n,
      interest: 3_473_599n,
      principal: 1_066_595n,
      remaining: 426_453_322n,
    });
  });

  it("a change recorded during the fixed tiers only bites at 37", () => {
    const rows = buildSchedule({
      ...KPR_500,
      ratePlan: {
        ...BERJENJANG,
        floatingChanges: [{ effectivePeriod: 10, ratePercent: "10.25" }],
      },
    });
    expect(rows[9]?.interest).toBe(1_420_050n);
    expect(rows[35]?.installment).toBe(3_390_269n);
    expect(rows[36]).toEqual({
      period: 37,
      installment: 4_653_225n,
      interest: 3_832_477n,
      principal: 820_748n,
      remaining: 447_859_492n,
    });
  });

  it("0% promo 12 bln then 10% floating: no interest, then re-annuitised at 13", () => {
    const rows = buildSchedule({
      ...KPR_500,
      remainingBalance: 120_000_000n,
      originalPrincipal: 120_000_000n,
      annualInterestRatePercent: "0",
      installmentAmount: 1_000_000n,
      remainingMonths: 120,
      ratePlan: {
        segments: [
          { kind: "fixed", months: 12, ratePercent: "0" },
          { kind: "floating", months: null, ratePercent: "10.00" },
        ],
        floatingChanges: [],
      },
    });
    expect(rows[11]).toEqual({
      period: 12,
      installment: 1_000_000n,
      interest: 0n,
      principal: 1_000_000n,
      remaining: 108_000_000n,
    });
    expect(rows[12]).toEqual({
      period: 13,
      installment: 1_520_498n,
      interest: 900_000n,
      principal: 620_498n,
      remaining: 107_379_502n,
    });
    expect(rows[119]).toEqual({
      period: 120,
      installment: 1_520_511n,
      interest: 12_566n,
      principal: 1_507_945n,
      remaining: 0n,
    });
  });

  it("murabahah 300 jt / 6.00% / 180 bln: every installment equal, last absorbs rounding", () => {
    const installment = computeInstallment({
      method: "anuitas",
      principal: 300_000_000n,
      annualInterestRatePercent: "6.00",
      tenorMonths: 180,
    });
    expect(installment).toBe(2_531_570n);
    const rows = buildSchedule({
      ...KPR_500,
      remainingBalance: 300_000_000n,
      originalPrincipal: 300_000_000n,
      annualInterestRatePercent: "6.00",
      installmentAmount: installment,
      remainingMonths: 180,
      ratePlan: {
        segments: [{ kind: "fixed", months: null, ratePercent: "6.00" }],
        floatingChanges: [],
      },
    });
    expect(rows.slice(0, 179).every((r) => r.installment === installment)).toBe(
      true,
    );
    expect(rows[179]).toEqual({
      period: 180,
      installment: 2_531_721n,
      interest: 12_596n,
      principal: 2_519_125n,
      remaining: 0n,
    });
    expect(rows.reduce((s, r) => s + r.installment, 0n)).toBe(455_682_751n);
  });

  it("FLPP 150 jt / 5.00% / 480 bln", () => {
    const installment = computeInstallment({
      method: "anuitas",
      principal: 150_000_000n,
      annualInterestRatePercent: "5.00",
      tenorMonths: 480,
    });
    expect(installment).toBe(723_295n);
    const rows = buildSchedule({
      ...KPR_500,
      remainingBalance: 150_000_000n,
      originalPrincipal: 150_000_000n,
      annualInterestRatePercent: "5.00",
      installmentAmount: installment,
      remainingMonths: 480,
      ratePlan: {
        segments: [{ kind: "fixed", months: null, ratePercent: "5.00" }],
        floatingChanges: [],
      },
    });
    expect(rows).toHaveLength(480);
    expect(rows[479]).toEqual({
      period: 480,
      installment: 723_106n,
      interest: 3_000n,
      principal: 720_106n,
      remaining: 0n,
    });
  });

  it("past tenor: one payoff row at the latest recorded floating rate", () => {
    const rows = buildSchedule({
      ...KPR_500,
      remainingBalance: 1_000_000n,
      remainingMonths: 1,
      firstPeriod: 240,
      ratePlan: {
        ...BERJENJANG,
        floatingChanges: [{ effectivePeriod: 61, ratePercent: "9.75" }],
      },
    });
    expect(rows).toEqual([
      {
        period: 240,
        installment: 1_008_125n,
        interest: 8_125n,
        principal: 1_000_000n,
        remaining: 0n,
      },
    ]);
  });

  it("currentInstallment follows the plan: tier 1 at 13, tier 2 at 30", () => {
    expect(
      currentInstallment({
        ...KPR_500,
        remainingBalance: 482_422_215n,
        remainingMonths: 228,
        firstPeriod: 13,
        ratePlan: BERJENJANG,
      }),
    ).toBe(2_899_799n);
    expect(
      currentInstallment({
        ...KPR_500,
        remainingBalance: 457_848_118n,
        remainingMonths: 211,
        firstPeriod: 30,
        ratePlan: BERJENJANG,
      }),
    ).toBe(3_390_269n);
  });

  it("legacy G terms and the equivalent explicit plan give identical schedules", () => {
    const legacy = buildSchedule({
      ...KPR_500,
      annualInterestRatePercent: "8.00",
      installmentAmount: 4_182_200n,
      fixedRateMonths: 36,
      floatingRatePercent: "11.00",
    });
    const explicit = buildSchedule({
      ...KPR_500,
      annualInterestRatePercent: "8.00",
      installmentAmount: 4_182_200n,
      ratePlan: {
        segments: [
          { kind: "fixed", months: 36, ratePercent: "8.00" },
          { kind: "floating", months: null, ratePercent: "11.00" },
        ],
        floatingChanges: [],
      },
    });
    expect(explicit).toEqual(legacy);
    expect(legacy[36]?.installment).toBe(5_053_432n);
  });
});
describe("installmentAnchorPeriod — revisi K (recorded prepayment)", () => {
  // Berjenjang loan at #61 (floating 11%), 100 jt prepaid with reduce-tenor:
  // installment 4.869.889 kept, tenor 60 + 106 = 166, anchored at #61.
  const PERSISTED = {
    method: "anuitas" as const,
    remainingBalance: 328_462_235n,
    originalPrincipal: 500_000_000n,
    annualInterestRatePercent: "3.50",
    installmentAmount: 4_869_889n,
    remainingMonths: 106,
    firstPeriod: 61,
    fixedRateMonths: null,
    floatingRatePercent: null,
    ratePlan: BERJENJANG,
  };

  it("anchored at the prepayment period: the stored installment is used as-is and pays off at #166", () => {
    const rows = buildSchedule({ ...PERSISTED, installmentAnchorPeriod: 61 });
    expect(rows[0]).toEqual({
      period: 61,
      installment: 4_869_889n,
      interest: 3_010_904n,
      principal: 1_858_985n,
      remaining: 326_603_250n,
    });
    expect(rows[12]?.installment).toBe(4_869_889n);
    expect(rows).toHaveLength(106);
    expect(rows[105]).toEqual({
      period: 166,
      installment: 2_633_995n,
      interest: 23_926n,
      principal: 2_610_069n,
      remaining: 0n,
    });
  });

  it("without the anchor the floating regime would silently re-annuitise it (4.857.320)", () => {
    expect(buildSchedule(PERSISTED)[0]?.installment).toBe(4_857_320n);
  });
});
