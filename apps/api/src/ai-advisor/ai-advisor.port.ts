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

/**
 * EPIC-023 Task G retry (CRITICAL five-reviewer finding) — every provider
 * reports whether the model's own generation stopped early because it hit
 * the token cap (Claude's `stop_reason: "max_tokens"`, OpenAI's
 * `finish_reason: "length"`, Gemini's `finishReason: "MAX_TOKENS"`). A
 * truncated answer must never be indistinguishable from a complete one —
 * the controller/UI needs this flag to say so explicitly instead of
 * quietly ending the sentence mid-thought.
 */
export type AdvisorChatResult = {
  truncated: boolean;
};

// EPIC-023 G3 (D16) — provider adapters (Claude/OpenAI/Gemini) implement
// this directly; there is no DI token anymore (`AI_ADVISOR_PORT` was
// removed) because the adapter is now built per request from the caller's
// own decrypted family key — see AiAdvisorFactory.
export abstract class AiAdvisorPort {
  abstract chat(
    context: AdvisorContext,
    messages: AdvisorMessage[],
    onToken: (token: string) => void,
  ): Promise<AdvisorChatResult>;
}
