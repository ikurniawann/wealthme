import Anthropic from "@anthropic-ai/sdk";

import { ExternalRequestTimeoutError } from "../common/utils/external-fetch.util";

import { buildAdvisorSystemPrompt } from "./advisor-prompt.util";
import {
  ADVISOR_MAX_TOOL_ROUNDS,
  ADVISOR_TOOL_DECLARATION,
  type AdvisorToolRunner,
} from "./advisor-tools";
import {
  AiAdvisorAuthError,
  AiAdvisorRateLimitError,
} from "./ai-advisor-provider.error";
import { AiAdvisorPort } from "./ai-advisor.port";

import type {
  AdvisorChatResult,
  AdvisorContext,
  AdvisorMessage,
} from "./ai-advisor.port";

const MODEL = "claude-sonnet-4-6" as const;
// EPIC-023 Task G retry (HIGH five-reviewer finding) — bounds the whole
// streamed request; generous enough for a full 1024-token answer, bounded
// enough that a stalled connection cannot hang the chat request forever.
const CLAUDE_REQUEST_TIMEOUT_MS = 60_000;

/**
 * NOT `@Injectable()`, deliberately. This is built by hand, per request, from
 * the family's own decrypted key — it is never registered as a provider and
 * Nest could not construct it anyway (its constructor takes a runtime string).
 * Carrying the decorator claimed the opposite, and made `di-paramtypes.spec.ts`
 * police a class the container never touches.
 */
export class ClaudeAdvisorService extends AiAdvisorPort {
  private readonly client: Anthropic;

  /** The family's chosen model, or the WealthMe default when they have not
   *  chosen one. Resolved per instance because the adapter is built per
   *  request from that family's own key. */
  private readonly model: string;

  constructor(apiKey: string, chosenModel?: string | null) {
    super();
    this.model = chosenModel?.trim() || MODEL;
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Tool rounds, before a single token is shown. Bounded by
   * `ADVISOR_MAX_TOOL_ROUNDS`: after that the model answers with what it has,
   * because an unbounded loop is a model deciding how much of the family's
   * quota to spend.
   */
  private async runToolRounds(
    convo: Anthropic.MessageParam[],
    system: string,
    runTool: AdvisorToolRunner,
  ): Promise<void> {
    for (let round = 0; round < ADVISOR_MAX_TOOL_ROUNDS; round += 1) {
      const reply = await this.client.messages.create(
        {
          model: this.model,
          max_tokens: 4096,
          system,
          messages: convo,
          tools: [
            {
              name: ADVISOR_TOOL_DECLARATION.name,
              description: ADVISOR_TOOL_DECLARATION.description,
              input_schema:
                ADVISOR_TOOL_DECLARATION.parameters as Anthropic.Tool["input_schema"],
            },
          ],
        },
        { timeout: CLAUDE_REQUEST_TIMEOUT_MS },
      );

      const calls = reply.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
      );
      // Nothing to fetch — let the streaming turn write the answer, so the
      // user still sees it arrive live.
      if (calls.length === 0) return;

      convo.push({ role: "assistant", content: reply.content });
      convo.push({
        role: "user",
        content: await Promise.all(
          calls.map(async (call) => ({
            type: "tool_result" as const,
            tool_use_id: call.id,
            content: await runTool(call.name, call.input),
          })),
        ),
      });
    }
  }

  async chat(
    context: AdvisorContext,
    messages: AdvisorMessage[],
    onToken: (token: string) => void,
    runTool?: AdvisorToolRunner,
  ): Promise<AdvisorChatResult> {
    const system = buildAdvisorSystemPrompt(context);
    const convo: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    try {
      if (runTool) await this.runToolRounds(convo, system, runTool);
      const stream = this.client.messages.stream(
        {
          model: this.model,
          max_tokens: 4096,
          system,
          // Tools are deliberately NOT offered on this turn: it exists to
          // answer, and a tool call mid-stream could not be serviced.
          messages: convo,
        },
        { timeout: CLAUDE_REQUEST_TIMEOUT_MS },
      );

      let stopReason: string | null = null;
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          onToken(event.delta.text);
        }
        if (event.type === "message_delta") {
          stopReason = event.delta.stop_reason;
        }
      }

      // EPIC-023 Task G retry (CRITICAL five-reviewer finding, round 2) — a
      // response that stopped because it hit max_tokens is TRUNCATED, not
      // complete. But `stopReason` staying `null` is ALSO not a complete
      // answer: it means the stream ended (the async iterator finished)
      // WITHOUT ever delivering the `message_delta` terminal event — the
      // "clean but premature" case a reviewer named (a proxy/load-balancer
      // idle timeout that ends the connection with no terminal frame). A
      // hard connection kill already throws out of this loop and is caught
      // below; only this silent, no-signal case was reported as `truncated:
      // false`, indistinguishable from a real complete answer. Absence of
      // the terminal signal must never read as a clean completion.
      return { truncated: stopReason === "max_tokens" || stopReason === null };
    } catch (err: unknown) {
      if (err instanceof Anthropic.APIConnectionTimeoutError) {
        throw new ExternalRequestTimeoutError("Claude request");
      }
      if (err instanceof Anthropic.AuthenticationError) {
        throw new AiAdvisorAuthError("Claude");
      }
      if (err instanceof Anthropic.RateLimitError) {
        throw new AiAdvisorRateLimitError("Claude");
      }
      throw err;
    }
  }
}
