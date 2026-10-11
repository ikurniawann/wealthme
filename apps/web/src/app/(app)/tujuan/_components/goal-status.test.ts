import type { GoalDto } from "@wealthme/contracts";
import { effectiveGoalStatus } from "./goal-status";

const NOW = new Date(2026, 9, 11);

function goal(over: Partial<GoalDto>): GoalDto {
  return {
    id: "g",
    name: "Liburan",
    icon: null,
    targetAmount: 12_000_000,
    currentAmount: 0,
    targetDate: new Date(2027, 9, 11).toISOString(),
    autoDebitAmount: null,
    status: "on_track",
    progressPercent: 0,
    remainingAmount: 12_000_000,
    ...over,
  } as GoalDto;
}

describe("effectiveGoalStatus", () => {
  it("an on-pace goal with no plan to reach its target needs a boost", () => {
    expect(effectiveGoalStatus(goal({}), NOW)).toBe("needs_boost");
  });

  it("an auto-debit that is too small to reach the target needs a boost", () => {
    // 12 jt over 12 months needs 1 jt a month.
    expect(effectiveGoalStatus(goal({ autoDebitAmount: 500_000 }), NOW)).toBe(
      "needs_boost",
    );
  });

  it("an auto-debit that covers the monthly need stays on track", () => {
    expect(effectiveGoalStatus(goal({ autoDebitAmount: 1_000_000 }), NOW)).toBe(
      "on_track",
    );
  });

  it("leaves server verdicts other than on_track alone, and goals with no date", () => {
    expect(effectiveGoalStatus(goal({ status: "at_risk" }), NOW)).toBe(
      "at_risk",
    );
    expect(effectiveGoalStatus(goal({ targetDate: null }), NOW)).toBe(
      "on_track",
    );
    expect(
      effectiveGoalStatus(
        goal({ status: "achieved", remainingAmount: 0 }),
        NOW,
      ),
    ).toBe("achieved");
  });
});
