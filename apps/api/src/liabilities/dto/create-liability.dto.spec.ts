import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreateLiabilityDto } from "./create-liability.dto";
import { UpdateLiabilityDto } from "./update-liability.dto";

const BASE = {
  name: "Cicilan Mobil",
  type: "kendaraan",
  totalDebt: "200000000",
  remainingBalance: "200000000",
};

async function invalidProps(
  cls: typeof CreateLiabilityDto | typeof UpdateLiabilityDto,
  body: Record<string, unknown>,
): Promise<string[]> {
  const errors = await validate(plainToInstance(cls, body));
  return errors.map((e) => e.property);
}

describe("Create/UpdateLiabilityDto — revisi G interest terms", () => {
  it("accepts a full flat/anuitas term set", async () => {
    expect(
      await invalidProps(CreateLiabilityDto, {
        ...BASE,
        interestMethod: "anuitas",
        tenorMonths: 240,
        startDate: "2026-01-15T00:00:00.000Z",
        installmentAmount: "4182200",
        fixedRateMonths: 36,
        floatingRate: "11.00",
      }),
    ).toEqual([]);
  });

  it.each([
    ["interestMethod", "bunga"],
    ["tenorMonths", 0],
    ["tenorMonths", 601],
    ["tenorMonths", 1.5],
    ["startDate", "kemarin"],
    ["installmentAmount", "-5"],
    ["fixedRateMonths", 0],
    ["floatingRate", "11,5"],
  ])("CreateLiabilityDto rejects %s = %p", async (field, value) => {
    expect(
      await invalidProps(CreateLiabilityDto, { ...BASE, [field]: value }),
    ).toContain(field);
  });

  it("UpdateLiabilityDto validates the same fields", async () => {
    expect(
      await invalidProps(UpdateLiabilityDto, { tenorMonths: 0 }),
    ).toContain("tenorMonths");
    expect(
      await invalidProps(UpdateLiabilityDto, { interestMethod: "flat" }),
    ).toEqual([]);
  });

  it("update accepts startDate null so a cleared Tanggal Akad can be persisted", async () => {
    expect(await invalidProps(UpdateLiabilityDto, { startDate: null })).toEqual(
      [],
    );
    expect(
      await invalidProps(UpdateLiabilityDto, { startDate: "not-a-date" }),
    ).toEqual(["startDate"]);
  });
});

describe("Create/UpdateLiabilityDto — revisi K rate periods", () => {
  const KPR = { ...BASE, type: "kpr" };
  const BERJENJANG = [
    { kind: "fixed", months: 24, ratePercent: "3.50" },
    { kind: "fixed", months: 12, ratePercent: "5.50" },
    { kind: "floating", months: null, ratePercent: "11.00" },
  ];

  it("accepts a berjenjang plan with a scheme", async () => {
    expect(
      await invalidProps(CreateLiabilityDto, {
        ...KPR,
        kprScheme: "berjenjang",
        ratePeriods: BERJENJANG,
      }),
    ).toEqual([]);
  });

  it.each([
    ["kprScheme", "kpr_biasa"],
    ["ratePeriods", []],
    ["ratePeriods", [{ kind: "tetap", ratePercent: "5" }]],
    ["ratePeriods", [{ kind: "fixed", months: 0, ratePercent: "5" }]],
    ["ratePeriods", [{ kind: "fixed", ratePercent: "5,5" }]],
    ["ratePeriods", [{ kind: "fixed", ratePercent: "100" }]],
    [
      "ratePeriods",
      Array.from({ length: 11 }, () => ({
        kind: "fixed",
        months: 1,
        ratePercent: "5",
      })),
    ],
  ])("CreateLiabilityDto rejects %s = %j", async (field, value) => {
    expect(
      await invalidProps(CreateLiabilityDto, { ...KPR, [field]: value }),
    ).toContain(field);
  });

  it("UpdateLiabilityDto validates ratePeriods the same way", async () => {
    expect(
      await invalidProps(UpdateLiabilityDto, { ratePeriods: BERJENJANG }),
    ).toEqual([]);
    expect(
      await invalidProps(UpdateLiabilityDto, {
        ratePeriods: [{ kind: "fixed", months: 0, ratePercent: "5" }],
      }),
    ).toContain("ratePeriods");
  });
});

// E2E round 1, bug 1 — sibling audit: `name` must reject "" / whitespace.
describe("CreateLiabilityDto/UpdateLiabilityDto.name — E2E round 1 bug 1", () => {
  it("CreateLiabilityDto rejects an empty name", async () => {
    expect(
      await invalidProps(CreateLiabilityDto, { ...BASE, name: "" }),
    ).toContain("name");
  });

  it("CreateLiabilityDto rejects a whitespace-only name", async () => {
    expect(
      await invalidProps(CreateLiabilityDto, { ...BASE, name: "   " }),
    ).toContain("name");
  });

  it("UpdateLiabilityDto rejects an explicit empty name", async () => {
    expect(await invalidProps(UpdateLiabilityDto, { name: "" })).toContain(
      "name",
    );
  });

  it("UpdateLiabilityDto allows omitting name", async () => {
    expect(await invalidProps(UpdateLiabilityDto, { notes: "x" })).toHaveLength(
      0,
    );
  });
});
