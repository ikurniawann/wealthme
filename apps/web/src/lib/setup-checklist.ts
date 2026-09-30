export const SETUP_STEP_IDS = [
  "account",
  "budget",
  "transaction",
  "family",
  "goal",
] as const;

export type SetupStepId = (typeof SETUP_STEP_IDS)[number];

export type SetupChecklistInput = {
  hasAccount: boolean;
  hasBudget: boolean;
  hasTransaction: boolean;
  hasFamilyMember: boolean;
  hasGoal: boolean;
};

const INPUT_KEY_BY_STEP: Record<SetupStepId, keyof SetupChecklistInput> = {
  account: "hasAccount",
  budget: "hasBudget",
  transaction: "hasTransaction",
  family: "hasFamilyMember",
  goal: "hasGoal",
};

export function getSetupChecklistState(input: SetupChecklistInput) {
  const steps = SETUP_STEP_IDS.map((id) => ({
    id,
    complete: input[INPUT_KEY_BY_STEP[id]],
  }));
  const completedCount = steps.filter((step) => step.complete).length;

  return {
    steps,
    completedCount,
    complete: completedCount === SETUP_STEP_IDS.length,
    nextStep: steps.find((step) => !step.complete)?.id ?? null,
  };
}
