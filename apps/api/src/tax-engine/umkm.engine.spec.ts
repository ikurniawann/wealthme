import { umkmYear } from "./umkm.engine";

const J = 1_000_000n;
const twelve = (v: bigint) => Array.from({ length: 12 }, () => v);

describe("umkmYear", () => {
  it("12 × 70jt: exempt until cumulative 500jt, Aug pays on 60jt, total 1.700.000", () => {
    const r = umkmYear({
      taxYear: 2026,
      monthlyOmzet: twelve(70n * J),
      firstRegisteredYear: null,
    });
    expect(r.months.map((m) => m.tax)).toEqual([
      0n,
      0n,
      0n,
      0n,
      0n,
      0n,
      0n,
      300_000n,
      350_000n,
      350_000n,
      350_000n,
      350_000n,
    ]);
    expect(r).toMatchObject({
      totalOmzet: 840n * J,
      totalTax: 1_700_000n,
      exceedsCeiling: false,
      ineligibleReason: null,
    });
  });
  it("exactly Rp4,8M is within the ceiling; one rupiah more exceeds it", () => {
    expect(
      umkmYear({
        taxYear: 2026,
        monthlyOmzet: twelve(400n * J),
        firstRegisteredYear: null,
      }),
    ).toMatchObject({ totalTax: 21_500_000n, exceedsCeiling: false });
    const over = [...twelve(400n * J).slice(0, 11), 400n * J + 1n];
    expect(
      umkmYear({ taxYear: 2026, monthlyOmzet: over, firstRegisteredYear: null })
        .exceedsCeiling,
    ).toBe(true);
  });
  it("half-up per month: excess 123.456.789 → 617.284", () => {
    const r = umkmYear({
      taxYear: 2026,
      monthlyOmzet: [500n * J, 123_456_789n, ...twelve(0n).slice(2)],
      firstRegisteredYear: null,
    });
    expect(r.months[1]!.tax).toBe(617_284n);
  });
  it("registered 2018: tax year 2025 fully ineligible (7-year limit)", () => {
    const r = umkmYear({
      taxYear: 2025,
      monthlyOmzet: twelve(70n * J),
      firstRegisteredYear: 2018,
    });
    expect(r.months.every((m) => !m.eligible && m.tax === null)).toBe(true);
    expect(r).toMatchObject({ ineligibleReason: "time_limit", totalTax: 0n });
  });
  it("registered 2018: tax year 2026 all months eligible (PP 20/2026 removes the individual time limit for the year)", () => {
    const r = umkmYear({
      taxYear: 2026,
      monthlyOmzet: twelve(70n * J),
      firstRegisteredYear: 2018,
    });
    expect(r.months.every((m) => m.eligible)).toBe(true);
    expect(r).toMatchObject({ ineligibleReason: null, totalTax: 1_700_000n });
  });
  it("needs 12 months", () => {
    expect(() =>
      umkmYear({
        taxYear: 2026,
        monthlyOmzet: [1n],
        firstRegisteredYear: null,
      }),
    ).toThrow(RangeError);
  });
});
