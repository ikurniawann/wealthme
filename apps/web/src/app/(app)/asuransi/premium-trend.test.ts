import type { InsuranceDto } from "@wealthme/contracts";
import {
  monthlyPremiumByType,
  premiumTrendValues,
  rollingMonths,
} from "./premium-trend";

function policy(over: Partial<InsuranceDto>): InsuranceDto {
  return {
    id: "p",
    familyGroupId: "f",
    name: "Polis",
    provider: null,
    type: "jiwa",
    status: "aktif",
    coverageAmount: null,
    premiumAmount: "100000",
    premiumPeriod: "monthly",
    renewalDate: null,
    autoRenewDate: false,
    policyNumber: null,
    daysUntilRenewal: null,
    notes: null,
    currency: "IDR",
    beneficiaries: [],
    paidThisPeriod: false,
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

describe("rollingMonths", () => {
  it("ends at the current month, oldest first", () => {
    const months = rollingMonths(new Date(2026, 9, 7)).map((d) => [
      d.getFullYear(),
      d.getMonth(),
    ]);
    expect(months).toEqual([
      [2026, 4],
      [2026, 5],
      [2026, 6],
      [2026, 7],
      [2026, 8],
      [2026, 9],
    ]);
  });

  it("crosses the year boundary", () => {
    const months = rollingMonths(new Date(2026, 1, 28)).map((d) => [
      d.getFullYear(),
      d.getMonth(),
    ]);
    expect(months[0]).toEqual([2025, 8]);
    expect(months[5]).toEqual([2026, 1]);
  });
});

describe("monthlyPremiumByType", () => {
  it("groups active policies by type with the API's monthly-equivalent rule", () => {
    const rows = monthlyPremiumByType([
      policy({ type: "jiwa", premiumAmount: "100000" }),
      policy({
        type: "jiwa",
        premiumAmount: "300000",
        premiumPeriod: "quarterly",
      }),
      policy({
        type: "kesehatan",
        premiumAmount: "1200000",
        premiumPeriod: "yearly",
      }),
      policy({ type: "kendaraan", status: "kadaluarsa" }),
    ]);
    expect(rows).toEqual([
      { type: "jiwa", monthly: 200000 },
      { type: "kesehatan", monthly: 100000 },
    ]);
  });
});

describe("premiumTrendValues", () => {
  it("ends on the real monthly premium", () => {
    const values = premiumTrendValues(250000);
    expect(values).toHaveLength(6);
    expect(values[5]).toBe(250000);
  });
});
