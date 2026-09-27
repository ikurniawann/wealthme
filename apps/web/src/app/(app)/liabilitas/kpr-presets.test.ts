import type { LiabilityDto } from "@wealthme/contracts";

import {
  draftFromLiability,
  draftFromPreset,
  toRatePeriodsBody,
} from "./kpr-presets";

describe("draftFromPreset (revisi K)", () => {
  it("berjenjang: example periods from the research, a fresh copy every call", () => {
    const draft = draftFromPreset("berjenjang");
    expect(draft).toEqual({
      presetId: "berjenjang",
      scheme: "berjenjang",
      periods: [
        { kind: "fixed", months: "24", ratePercent: "3.50", source: "example" },
        { kind: "fixed", months: "12", ratePercent: "5.50", source: "example" },
        {
          kind: "floating",
          months: "",
          ratePercent: "11.00",
          source: "example",
        },
      ],
    });
    const [first] = draft.periods;
    if (first) first.ratePercent = "9.00";
    expect(draftFromPreset("berjenjang").periods[0]?.ratePercent).toBe("3.50");
  });

  it("FLPP rates are official; manual starts empty as the user's own", () => {
    expect(draftFromPreset("flpp_rusun").periods).toEqual([
      { kind: "fixed", months: "", ratePercent: "6.00", source: "official" },
    ]);
    expect(draftFromPreset("flpp_tapak").scheme).toBe("flpp");
    expect(draftFromPreset("manual")).toEqual({
      presetId: "manual",
      scheme: null,
      periods: [{ kind: "fixed", months: "", ratePercent: "", source: "user" }],
    });
  });
});

describe("toRatePeriodsBody (revisi K)", () => {
  it("last period runs to maturity; Indonesian decimal commas are normalised", () => {
    expect(
      toRatePeriodsBody([
        { kind: "fixed", months: "24", ratePercent: "3,5", source: "user" },
        {
          kind: "floating",
          months: "999",
          ratePercent: "11",
          source: "example",
        },
      ]),
    ).toEqual([
      { kind: "fixed", months: 24, ratePercent: "3.5" },
      { kind: "floating", months: null, ratePercent: "11" },
    ]);
  });

  it.each([
    [
      "an empty rate",
      [{ kind: "fixed", months: "", ratePercent: "", source: "user" }],
    ],
    [
      "a zero-month tier",
      [
        { kind: "fixed", months: "0", ratePercent: "3.5", source: "user" },
        { kind: "floating", months: "", ratePercent: "11", source: "user" },
      ],
    ],
    [
      "a rate above 30%",
      [{ kind: "fixed", months: "", ratePercent: "31", source: "user" }],
    ],
    ["no periods", []],
  ] as const)("returns null for %s", (_label, periods) => {
    expect(toRatePeriodsBody([...periods])).toBeNull();
  });
});

describe("draftFromLiability (revisi K)", () => {
  const base = {
    type: "kpr",
    interestRate: "8",
    fixedRateMonths: null,
    floatingRate: null,
    kprScheme: null,
    ratePeriods: [],
  } as unknown as LiabilityDto;

  it("stored periods come back as the user's own numbers (never labelled examples)", () => {
    const draft = draftFromLiability({
      ...base,
      kprScheme: "flpp",
      ratePeriods: [{ kind: "fixed", months: null, ratePercent: "6.00" }],
    });
    expect(draft).toEqual({
      presetId: "flpp_rusun",
      scheme: "flpp",
      periods: [
        { kind: "fixed", months: "", ratePercent: "6.00", source: "user" },
      ],
    });
  });

  it("a G-era fixed/floating pair becomes two periods", () => {
    expect(
      draftFromLiability({ ...base, fixedRateMonths: 36, floatingRate: "11" })
        .periods,
    ).toEqual([
      { kind: "fixed", months: "36", ratePercent: "8", source: "user" },
      { kind: "floating", months: "", ratePercent: "11", source: "user" },
    ]);
  });

  it("a plain rate becomes one period to maturity", () => {
    expect(draftFromLiability(base).periods).toEqual([
      { kind: "fixed", months: "", ratePercent: "8", source: "user" },
    ]);
  });
});
