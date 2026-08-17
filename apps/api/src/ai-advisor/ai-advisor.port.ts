export type AdvisorContext = {
  familyGroupId: string;
  netWorth: bigint;
  monthlyIncome: bigint;
  monthlyExpense: bigint;
  totalAssets: bigint;
  totalLiabilities: bigint;
  topCategories: Array<{ name: string; amount: bigint }>;
  // Row-level detail. The context used to be six aggregates and nothing
  // else, so "berapa tagihan Kartu Kredit BCA saya?" was unanswerable even
  // though the row is right there on /liabilitas — and the model filled the
  // gap by inventing a reason ("no real-time access to your bank account,
  // for your privacy"), which was never true. These carry the individual
  // rows so the answer is grounded in real figures instead.
  //
  // Every list is already privacy- and role-filtered by `buildContext`; a
  // renderer must treat what it receives as safe to show THIS viewer and
  // must never re-derive its own totals from a truncated list.
  liabilities: Array<{
    name: string;
    institution: string | null;
    type: string;
    remainingBalance: bigint;
    minimumPayment: bigint;
    interestRate: string;
    dueDate: Date | null;
  }>;
  assets: Array<{ name: string; type: string; currentValue: bigint }>;
  // Deliberately no account NUMBER. Two separate leaks had to be closed for
  // that to be true: `Account.maskedNumber` is encrypted at rest
  // (CryptoService) and is never selected, AND the `name` is passed through
  // `stripMaskedNumber` first — accounts here are conventionally named with
  // the suffix baked in ("Mandiri ···5586"), so excluding the column alone
  // still handed the digits to the provider via the name.
  accounts: Array<{
    name: string;
    type: string;
    institution: string | null;
    balance: bigint;
  }>;
  goals: Array<{
    name: string;
    targetAmount: bigint;
    currentAmount: bigint;
    targetDate: Date | null;
  }>;
  /** True when a list above was capped, so the prompt can say "showing N of
   *  M" instead of letting the model present a partial list as complete. */
  truncatedLists: boolean;
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
