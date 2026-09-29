import { getActiveTransactionFilterCount } from "./filter-count";

describe("active transaction filter count", () => {
  it("counts each selected filter field once", () => {
    expect(
      getActiveTransactionFilterCount({
        hasDateRange: true,
        hasAccount: true,
        hasCategory: true,
        hasType: true,
        hasSort: true,
      }),
    ).toBe(5);
  });

  it("does not count default or empty values", () => {
    expect(
      getActiveTransactionFilterCount({
        hasDateRange: false,
        hasAccount: false,
        hasCategory: false,
        hasType: false,
        hasSort: false,
      }),
    ).toBe(0);
  });
});
