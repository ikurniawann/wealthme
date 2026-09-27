import { BadRequestException } from "@nestjs/common";

import { legacyRatePlan } from "./rate-plan.util";
import {
  assertKprRate,
  sameSegments,
  validateKprScheme,
  validateRatePeriods,
} from "./rate-plan.validation";

const BERJENJANG = [
  { kind: "fixed" as const, months: 24, ratePercent: "3.50" },
  { kind: "fixed" as const, months: 12, ratePercent: "5.50" },
  { kind: "floating" as const, months: null, ratePercent: "11.00" },
];
const OK = {
  type: "kpr",
  interestMethod: "anuitas" as const,
  tenorMonths: 240,
  kprScheme: "berjenjang" as const,
  periods: BERJENJANG,
  hasFloatingHistory: false,
};

describe("validateRatePeriods — revisi K", () => {
  it("returns engine segments for a valid berjenjang plan", () => {
    expect(validateRatePeriods(OK)).toEqual(BERJENJANG);
  });

  it("omitted months on the last period means to maturity", () => {
    expect(
      validateRatePeriods({
        ...OK,
        kprScheme: "flpp",
        periods: [{ kind: "fixed", ratePercent: "5.00" }],
      }),
    ).toEqual([{ kind: "fixed", months: null, ratePercent: "5.00" }]);
  });

  it.each([
    ["not a KPR", { type: "kendaraan" }],
    ["not anuitas", { interestMethod: "flat" as const }],
    ["no tenor", { tenorMonths: null }],
    ["bounded periods fill the tenor", { tenorMonths: 36 }],
    [
      "open-ended period before the last",
      {
        periods: [
          { kind: "fixed" as const, months: null, ratePercent: "3.50" },
          ...BERJENJANG.slice(1),
        ],
      },
    ],
    ["last period bounded", { periods: BERJENJANG.slice(0, 2) }],
    [
      "rate above 30%",
      {
        periods: [
          { kind: "fixed" as const, months: null, ratePercent: "30.01" },
        ],
        kprScheme: null,
      },
    ],
    [
      "murabahah with a floating tail",
      { kprScheme: "syariah_murabahah" as const },
    ],
    [
      "FLPP over 480 months",
      {
        kprScheme: "flpp" as const,
        tenorMonths: 481,
        periods: [
          { kind: "fixed" as const, months: null, ratePercent: "5.00" },
        ],
      },
    ],
    [
      "dropping floating while history exists",
      {
        hasFloatingHistory: true,
        kprScheme: null,
        periods: [
          { kind: "fixed" as const, months: null, ratePercent: "6.00" },
        ],
      },
    ],
  ])("rejects: %s", (_label, patch) => {
    expect(() => validateRatePeriods({ ...OK, ...patch })).toThrow(
      BadRequestException,
    );
  });

  it("accepts 30.00% and 0% exactly", () => {
    expect(() => assertKprRate("30.00", "r")).not.toThrow();
    expect(() => assertKprRate("0", "r")).not.toThrow();
  });
});

describe("validateKprScheme — revisi K", () => {
  it("only a KPR carries a scheme", () => {
    expect(validateKprScheme("kpr", "flpp")).toBe("flpp");
    expect(validateKprScheme("kendaraan", undefined)).toBeNull();
    expect(() => validateKprScheme("kendaraan", "flpp")).toThrow(
      BadRequestException,
    );
  });
});

describe("sameSegments — revisi K", () => {
  it("compares rates by value and months exactly", () => {
    const a = legacyRatePlan("5.5", 36, "11").segments;
    expect(sameSegments(a, legacyRatePlan("5.50", 36, "11.00").segments)).toBe(
      true,
    );
    expect(sameSegments(a, legacyRatePlan("5.50", 24, "11.00").segments)).toBe(
      false,
    );
    expect(sameSegments(a, legacyRatePlan("5.51", 36, "11.00").segments)).toBe(
      false,
    );
    expect(sameSegments(a, a.slice(0, 1))).toBe(false);
  });
});
