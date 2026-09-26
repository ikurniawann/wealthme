import { dtpEligibility } from "./dtp.engine";

import type { DtpProfile } from "./dtp.engine";

const permanent = (o: Partial<DtpProfile> = {}): DtpProfile => ({
  sector: "tekstil_pakaian",
  employment: "permanent",
  dailyWage: null,
  nikValidated: true,
  ...o,
});

describe("dtpEligibility", () => {
  it("exactly Rp10.000.000 is eligible; Rp10.000.001 is not", () => {
    expect(
      dtpEligibility({
        taxYear: 2026,
        month: 3,
        monthlyGross: 10_000_000n,
        profile: permanent(),
      }),
    ).toMatchObject({ eligible: true, reasons: [] });
    expect(
      dtpEligibility({
        taxYear: 2026,
        month: 3,
        monthlyGross: 10_000_001n,
        profile: permanent(),
      }),
    ).toMatchObject({ eligible: false, reasons: ["gross_above_cap"] });
  });
  it("2026 requires a Coretax-validated NIK; 2025 does not", () => {
    expect(
      dtpEligibility({
        taxYear: 2026,
        month: 3,
        monthlyGross: 5_000_000n,
        profile: permanent({ nikValidated: false }),
      }).reasons,
    ).toEqual(["nik_not_validated"]);
    expect(
      dtpEligibility({
        taxYear: 2025,
        month: 3,
        monthlyGross: 5_000_000n,
        profile: permanent({ nikValidated: false }),
      }).eligible,
    ).toBe(true);
  });
  it("2024 has no program", () => {
    expect(
      dtpEligibility({
        taxYear: 2024,
        month: 6,
        monthlyGross: 5_000_000n,
        profile: permanent(),
      }).reasons,
    ).toEqual(["no_program"]);
  });
  it("pariwisata: not covered in Sep 2025, covered (unverified) from Oct 2025", () => {
    const p = permanent({ sector: "pariwisata" });
    expect(
      dtpEligibility({
        taxYear: 2025,
        month: 9,
        monthlyGross: 5_000_000n,
        profile: p,
      }).reasons,
    ).toEqual(["sector_not_covered"]);
    const oct = dtpEligibility({
      taxYear: 2025,
      month: 10,
      monthlyGross: 5_000_000n,
      profile: p,
    });
    expect(oct.eligible).toBe(true);
    expect(oct.ref.verified).toBe(false);
  });
  it("no sector chosen → sector_not_covered", () => {
    expect(
      dtpEligibility({
        taxYear: 2026,
        month: 1,
        monthlyGross: 1n,
        profile: permanent({ sector: null }),
      }).reasons,
    ).toEqual(["sector_not_covered"]);
  });
  it("non-permanent: daily wage ≤ 500rb eligible; 500.001 not, unless 2026 monthly ≤ 10jt", () => {
    const np = (dailyWage: bigint) =>
      permanent({ employment: "non_permanent", dailyWage });
    expect(
      dtpEligibility({
        taxYear: 2025,
        month: 5,
        monthlyGross: 12_000_000n,
        profile: np(500_000n),
      }).eligible,
    ).toBe(true);
    expect(
      dtpEligibility({
        taxYear: 2025,
        month: 5,
        monthlyGross: 9_000_000n,
        profile: np(500_001n),
      }).reasons,
    ).toEqual(["daily_wage_above_cap"]);
    expect(
      dtpEligibility({
        taxYear: 2026,
        month: 5,
        monthlyGross: 9_000_000n,
        profile: np(500_001n),
      }).eligible,
    ).toBe(true);
  });
});
