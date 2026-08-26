import { z } from "zod";

import {
  ExternalRequestTimeoutError,
  fetchWithTimeout,
  isAbortTimeoutError,
} from "../common/utils/external-fetch.util";

import { buildAdvisorSystemPrompt } from "./advisor-prompt.util";
import {
  AiAdvisorAuthError,
  AiAdvisorRateLimitError,
} from "./ai-advisor-provider.error";
import { AiAdvisorPort } from "./ai-advisor.port";
import { consumeSseStream } from "./sse.util";

import type {
  AdvisorChatResult,
  AdvisorContext,
  AdvisorMessage,
} from "./ai-advisor.port";

const OPENAI_CHAT_COMPLETIONS_URL =
  "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini" as const;
const MAX_TOKENS = 1024;
const DONE_SENTINEL = "[DONE]";
// EPIC-023 Task G retry (HIGH five-reviewer finding) — bounds the whole
// streamed request so a stalled connection cannot hang the chat request
// forever.
const OPENAI_REQUEST_TIMEOUT_MS = 60_000;

// EPIC-023 Task G retry (HIGH five-reviewer finding) — validate the
// streamed chunk shape at the boundary instead of a bare `as` cast; a
// malformed/unexpected chunk is skipped (matching the existing JSON.parse
// failure path) rather than crashing the whole stream.
const chatCompletionChunkSchema = z.object({
  choices: z
    .array(
      z.object({
        delta: z
          .object({ content: z.string().optional() })
          .partial()
          .optional(),
        finish_reason: z.string().nullable().optional(),
      }),
    )
    .optional(),
});

/**
 * EPIC-023 G3 (D16) — OpenAI adapter, provider-agnostic sibling of
 * ClaudeAdvisorService. Uses the stable Chat Completions streaming
 * endpoint (`stream: true`) directly via `fetch` — SSE frames of
 * `data: {...}` chunks, terminated by a literal `data: [DONE]` line.
 */
/**
 * NOT `@Injectable()`, deliberately. This is built by hand, per request, from
 * the family's own decrypted key — it is never registered as a provider and
 * Nest could not construct it anyway (its constructor takes a runtime string).
 * Carrying the decorator claimed the opposite, and made `di-paramtypes.spec.ts`
 * police a class the container never touches.
 */
export class OpenAiAdvisorService extends AiAdvisorPort {
  /** The family's chosen model, or the WealthMe default when they have not
   *  chosen one. Resolved per instance because the adapter is built per
   *  request from that family's own key. */
  private readonly model: string;

  constructor(
    private readonly apiKey: string,
    chosenModel?: string | null,
  ) {
    super();
    this.model = chosenModel?.trim() || MODEL;
  }

  async chat(
    context: AdvisorContext,
    messages: AdvisorMessage[],
    onToken: (token: string) => void,
  ): Promise<AdvisorChatResult> {
    // EPIC-023 Task G retry (HIGH five-reviewer finding, round 2) — the
    // whole request (fetch AND the streamed body) is wrapped, not just the
    // initial `fetchWithTimeout` call: `fetchWithTimeout`'s own AbortSignal
    // bounds the connection for as long as it's open, including while
    // `consumeSseStream` is still reading the body. A timeout firing AFTER
    // headers arrive (mid-stream) surfaces as an abort error from THAT
    // read, not from `fetchWithTimeout` — without this wrapping it was
    // unclassified instead of a recognisable `ExternalRequestTimeoutError`.
    try {
      const res = await fetchWithTimeout(
        OPENAI_CHAT_COMPLETIONS_URL,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.model,
            stream: true,
            max_tokens: MAX_TOKENS,
            messages: [
              { role: "system", content: buildAdvisorSystemPrompt(context) },
              ...messages.map((m) => ({ role: m.role, content: m.content })),
            ],
          }),
        },
        OPENAI_REQUEST_TIMEOUT_MS,
        "OpenAI request",
      );

      if (!res.ok || !res.body) {
        const body = await res.text().catch(() => "");
        if (res.status === 401 || res.status === 403) {
          throw new AiAdvisorAuthError("OpenAI");
        }
        if (res.status === 429) {
          throw new AiAdvisorRateLimitError("OpenAI");
        }
        throw new Error(
          `OpenAI request failed (${res.status}): ${body.slice(0, 300)}`,
        );
      }

      // EPIC-023 Task G retry (CRITICAL five-reviewer finding) —
      // `finish_reason: "length"` means the response was cut off by
      // max_tokens, not that it ended naturally.
      //
      // EPIC-023 Task G retry (CRITICAL five-reviewer finding, round 2) —
      // `truncated` alone isn't enough: a stream that ends WITHOUT ever
      // delivering a `finish_reason` at all (a clean-but-premature close,
      // e.g. a proxy/load-balancer idle timeout with no terminal chunk) is
      // also an incomplete answer, not a natural stop. `sawFinishSignal`
      // tracks whether the real API's terminal chunk (which always carries
      // a non-null `finish_reason`) was actually observed.
      let truncated = false;
      let sawFinishSignal = false;

      await consumeSseStream(res.body, (data) => {
        if (data === DONE_SENTINEL) return;
        let parsed: unknown;
        try {
          parsed = JSON.parse(data);
        } catch {
          return;
        }
        const chunk = chatCompletionChunkSchema.safeParse(parsed);
        if (!chunk.success) return;
        const choice = chunk.data.choices?.[0];
        if (choice?.finish_reason) {
          sawFinishSignal = true;
          if (choice.finish_reason === "length") truncated = true;
        }
        const token = choice?.delta?.content;
        if (token) onToken(token);
      });

      return { truncated: truncated || !sawFinishSignal };
    } catch (err: unknown) {
      if (isAbortTimeoutError(err)) {
        throw new ExternalRequestTimeoutError("OpenAI request");
      }
      throw err;
    }
  }
}
