export type AdvisorContext = {
  familyGroupId: string;
  netWorth: bigint;
  monthlyIncome: bigint;
  monthlyExpense: bigint;
  totalAssets: bigint;
  totalLiabilities: bigint;
  topCategories: Array<{ name: string; amount: bigint }>;
};

export type AdvisorMessage = {
  role: "user" | "assistant";
  content: string;
};

export abstract class AiAdvisorPort {
  abstract chat(
    context: AdvisorContext,
    messages: AdvisorMessage[],
    onToken: (token: string) => void,
  ): Promise<void>;
}

export const AI_ADVISOR_PORT = "AI_ADVISOR_PORT";
