import { nextRenewalDate } from "./page";

jest.mock("../../../lib/auth-compat", () => ({
  useSession: () => ({ data: null, isPending: false }),
}));

jest.mock("../../../lib/api-client", () => ({
  apiFetch: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  }),
}));

describe("nextRenewalDate", () => {
  it("advances a mid-month date by one month", () => {
    expect(nextRenewalDate("2026-03-15", "monthly")).toBe("2026-04-15");
  });

  it("clamps Jan 31 monthly to the last day of February", () => {
    expect(nextRenewalDate("2024-01-31", "monthly")).toBe("2024-02-29");
    expect(nextRenewalDate("2025-01-31", "monthly")).toBe("2025-02-28");
  });

  it("clamps Nov 30 quarterly to the last day of February", () => {
    expect(nextRenewalDate("2023-11-30", "quarterly")).toBe("2024-02-29");
  });

  it("clamps Feb 29 yearly to Feb 28 of the next year", () => {
    expect(nextRenewalDate("2024-02-29", "yearly")).toBe("2025-02-28");
  });

  it("crosses a year boundary on monthly advance", () => {
    expect(nextRenewalDate("2026-12-31", "monthly")).toBe("2027-01-31");
  });
});
