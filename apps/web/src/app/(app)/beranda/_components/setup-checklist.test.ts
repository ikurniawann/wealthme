import { getSetupChecklistState } from "./setup-checklist";

describe("setup checklist", () => {
  it("marks completed steps and finds the first unfinished step", () => {
    const state = getSetupChecklistState({
      hasAccount: true,
      hasBudget: true,
      hasTransaction: false,
      hasFamilyMember: false,
      hasGoal: false,
    });

    expect(state.completedCount).toBe(2);
    expect(state.nextStep).toBe("transaction");
    expect(state.complete).toBe(false);
  });

  it("allows dismissal only after all five steps are complete", () => {
    const state = getSetupChecklistState({
      hasAccount: true,
      hasBudget: true,
      hasTransaction: true,
      hasFamilyMember: true,
      hasGoal: true,
    });

    expect(state.completedCount).toBe(5);
    expect(state.nextStep).toBeNull();
    expect(state.complete).toBe(true);
  });
});
