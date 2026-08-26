import { z } from "zod";

import {
  ExternalRequestTimeoutError,
  fetchWithTimeout,
  isAbortTimeoutError,
} from "../common/utils/external-fetch.util";

import { buildAdvisorSystemPrompt } from "./advisor-prompt.util";
import {
  ADVISOR_MAX_TOOL_ROUNDS,
  ADVISOR_TOOL_DECLARATION,
  type AdvisorToolRunner,
} from "./advisor-tools";
import {
  AiAdvisorAuthError,
  AiAdvisorRateLimitError,
  type RateLimitScope,
} from "./ai-advisor-provider.error";
import { AiAdvisorPort } from "./ai-advisor.port";
import { consumeSseStream } from "./sse.util";

import type {
  AdvisorChatResult,
  AdvisorContext,
  AdvisorMessage,
} from "./ai-advisor.port";

// Google retires model IDs out from under callers: `gemini-2.0-flash` started
// answering every request with a 404 ("This model ... is no longer available.
// Please update your code to use models/gemini-3.6-flash"), which surfaced in
// the UI as a chat that never started even with a perfectly valid API key.
// `GEMINI_MODEL` overrides the default so the next retirement is an env change,
// not a redeploy.
//
// The default is NOT the model Google's own error message named. Taking that
// advice moved the advisor onto a free tier of **20 requests per day**
// (verified from the 429 payload: `quotaId:
// GenerateRequestsPerDayPerProjectPerModel-FreeTier, quotaValue: 20`), which a
// single afternoon of use exhausts — every suggestion chip then answered with a
// rate-limit notice. Google gives the newest model the tightest free quota, so
// the default is a generation-older GA model instead; a probe against the same
// streaming endpoint confirmed 2.5/3.5 flash and the lite variants all still
// answer while 3.6 is exhausted. Set `GEMINI_MODEL=gemini-3.6-flash` to go back
// on a paid plan.
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

/**
 * Turns Google's 429 body into an error that can say something useful.
 *
 * Shape (trimmed):
 *   { error: { message, details: [
 *       { "@type": ".../QuotaFailure", violations: [{ quotaId, quotaValue }] },
 *       { "@type": ".../RetryInfo", retryDelay: "23s" } ] } }
 *
 * Parsed defensively — a body that is empty, truncated, or reshaped by Google
 * must still yield a plain rate-limit error rather than throwing a
 * `SyntaxError` from inside an error path, which would surface to the user as
 * an unclassified failure instead of "rate limited".
 */
export function parseGeminiRateLimit(body: string): AiAdvisorRateLimitError {
  let scope: RateLimitScope | undefined;
  let retryAfterSeconds: number | undefined;
  let detail: string | undefined;

  try {
    const parsed = JSON.parse(body) as {
      error?: {
        message?: string;
        details?: Array<{
          "@type"?: string;
          retryDelay?: string;
          violations?: Array<{ quotaId?: string }>;
        }>;
      };
    };
    detail = parsed.error?.message;

    for (const item of parsed.error?.details ?? []) {
      // Match on the quota id rather than the human-readable message, which is
      // prose Google is free to reword.
      for (const violation of item.violations ?? []) {
        if (violation.quotaId?.includes("PerDay")) scope = "daily";
        else if (violation.quotaId) scope ??= "short";
      }
      if (item.retryDelay) {
        const seconds = Number.parseFloat(item.retryDelay.replace(/s$/, ""));
        if (Number.isFinite(seconds) && seconds > 0) {
          retryAfterSeconds = Math.ceil(seconds);
        }
      }
    }
  } catch {
    // Leave everything undefined — the generic message still applies.
  }

  // Google sends a short `retryDelay` (e.g. 23s) even for a PER-DAY cap — it
  // describes its token bucket, not when the day resets. Passing it on would
  // reproduce the exact lie this function exists to remove, so a daily cap
  // reports no retry delay at all.
  return new AiAdvisorRateLimitError(
    "Gemini",
    scope,
    scope === "daily" ? undefined : retryAfterSeconds,
    detail,
  );
}
/** One turn of the Gemini conversation: plain text, a tool call, or a tool
 *  result. Typed here because the tool rounds append shapes the plain
 *  message mapping never produced. */
type GeminiContent = {
  role: "user" | "model";
  parts: Record<string, unknown>[];
};

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
// EPIC-023 Task G retry (HIGH five-reviewer finding) — bounds the whole
// streamed request so a stalled connection cannot hang the chat request
// forever.
const GEMINI_REQUEST_TIMEOUT_MS = 60_000;

// EPIC-023 Task G retry (HIGH five-reviewer finding) — validate the
// streamed chunk shape at the boundary instead of a bare `as` cast.
const geminiStreamChunkSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({
            parts: z
              .array(z.object({ text: z.string().optional() }))
              .optional(),
          })
          .optional(),
        finishReason: z.string().optional(),
      }),
    )
    .optional(),
});

/**
 * EPIC-023 G3 (D16) — Gemini adapter, provider-agnostic sibling of
 * ClaudeAdvisorService/OpenAiAdvisorService. Uses the
 * `streamGenerateContent?alt=sse` endpoint, which frames chunks as
 * `data: {...}` SSE events (no DONE sentinel — the stream simply ends).
 * Gemini's roles are "user"/"model" (not "assistant"), mapped below.
 */
/**
 * NOT `@Injectable()`, deliberately. This is built by hand, per request, from
 * the family's own decrypted key — it is never registered as a provider and
 * Nest could not construct it anyway (its constructor takes a runtime string).
 * Carrying the decorator claimed the opposite, and made `di-paramtypes.spec.ts`
 * police a class the container never touches.
 */
export class GeminiAdvisorService extends AiAdvisorPort {
  /** The family's chosen model, or the WealthMe default when they have not
   *  chosen one. Resolved per instance because the adapter is built per
   *  request from that family's own key. */
  private readonly model: string;

  constructor(
    private readonly apiKey: string,
    chosenModel?: string | null,
  ) {
    super();
    this.model = chosenModel?.trim() || GEMINI_MODEL;
  }

  /**
   * Lets the model fetch what the prompt does not carry, before it answers.
   *
   * Bounded on purpose: `ADVISOR_MAX_TOOL_ROUNDS` calls, then the model must
   * answer with what it has. An unbounded loop would be a model deciding how
   * much of the family's quota to spend.
   */
  private async runToolRounds(
    contents: GeminiContent[],
    systemInstruction: { parts: { text: string }[] },
    runTool: AdvisorToolRunner,
  ): Promise<void> {
    const url = `${GEMINI_API_BASE}/models/${this.model}:generateContent`;

    for (let round = 0; round < ADVISOR_MAX_TOOL_ROUNDS; round += 1) {
      const res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.apiKey,
          },
          body: JSON.stringify({
            systemInstruction,
            contents,
            tools: [{ functionDeclarations: [ADVISOR_TOOL_DECLARATION] }],
          }),
        },
        GEMINI_REQUEST_TIMEOUT_MS,
        "Gemini tool request",
      );

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        if (res.status === 401 || res.status === 403)
          throw new AiAdvisorAuthError("Gemini");
        if (res.status === 429) throw parseGeminiRateLimit(body);
        throw new Error(
          `Gemini tool request failed (${res.status}): ${body.slice(0, 300)}`,
        );
      }

      const payload = (await res.json()) as {
        candidates?: {
          content?: {
            parts?: { functionCall?: { name?: string; args?: unknown } }[];
          };
        }[];
      };
      const parts = payload.candidates?.[0]?.content?.parts ?? [];
      const calls = parts.filter((p) => p.functionCall?.name);
      // No call means the model is ready to answer — leave the streaming
      // turn to produce the text, so the user still sees it arrive live.
      if (calls.length === 0) return;

      contents.push({
        role: "model",
        parts: calls.map((p) => ({ functionCall: p.functionCall })),
      });
      const responses = await Promise.all(
        calls.map(async (p) => ({
          functionResponse: {
            name: p.functionCall!.name!,
            response: {
              content: await runTool(
                p.functionCall!.name!,
                p.functionCall!.args,
              ),
            },
          },
        })),
      );
      contents.push({ role: "user", parts: responses });
    }
  }

  async chat(
    context: AdvisorContext,
    messages: AdvisorMessage[],
    onToken: (token: string) => void,
    runTool?: AdvisorToolRunner,
  ): Promise<AdvisorChatResult> {
    const url = `${GEMINI_API_BASE}/models/${this.model}:streamGenerateContent?alt=sse`;
    const systemInstruction = {
      parts: [{ text: buildAdvisorSystemPrompt(context) }],
    };

    // Tool rounds run NON-streaming and finish before a single token is
    // shown. Streaming a partial answer and then discovering the model wants
    // data would mean either abandoning what the user already read, or
    // answering from figures it never fetched.
    const contents: GeminiContent[] = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    if (runTool) {
      await this.runToolRounds(contents, systemInstruction, runTool);
    }

    // EPIC-023 Task G retry (HIGH five-reviewer finding, round 2) — the
    // whole request (fetch AND the streamed body) is wrapped, not just the
    // initial `fetchWithTimeout` call — see openai-advisor.service.ts's
    // matching comment for why a mid-stream abort otherwise surfaces
    // unclassified instead of as a timeout.
    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // EPIC-023 Task G retry (MEDIUM five-reviewer finding) — the key
            // in a query string can land in proxy/access logs; the header is
            // the documented, log-safe way to pass it.
            "x-goog-api-key": this.apiKey,
          },
          body: JSON.stringify({
            systemInstruction,
            // Tools are deliberately NOT offered here. This turn exists to
            // answer; leaving them on invites another tool call mid-stream,
            // which this call has no way to service.
            contents,
          }),
        },
        GEMINI_REQUEST_TIMEOUT_MS,
        "Gemini request",
      );

      if (!res.ok || !res.body) {
        const body = await res.text().catch(() => "");
        if (res.status === 401 || res.status === 403) {
          throw new AiAdvisorAuthError("Gemini");
        }
        if (res.status === 429) {
          // `body` was already read above and used to be discarded here.
          // Google puts the useful part in it: which quota ran out and when
          // to retry. See parseGeminiRateLimit.
          throw parseGeminiRateLimit(body);
        }
        throw new Error(
          `Gemini request failed (${res.status}): ${body.slice(0, 300)}`,
        );
      }

      // EPIC-023 Task G retry (CRITICAL five-reviewer finding) —
      // `finishReason: "MAX_TOKENS"` means the response was cut off, not
      // that it ended naturally.
      //
      // EPIC-023 Task G retry (CRITICAL five-reviewer finding, round 2) —
      // `truncated` alone isn't enough: a stream that ends WITHOUT ever
      // delivering a `finishReason` at all (a clean-but-premature close) is
      // also an incomplete answer. `sawFinishSignal` tracks whether the
      // real API's terminal candidate (which always carries a
      // `finishReason`) was actually observed.
      let truncated = false;
      let sawFinishSignal = false;

      await consumeSseStream(res.body, (data) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(data);
        } catch {
          return;
        }
        const chunk = geminiStreamChunkSchema.safeParse(parsed);
        if (!chunk.success) return;
        const candidate = chunk.data.candidates?.[0];
        if (candidate?.finishReason) {
          sawFinishSignal = true;
          if (candidate.finishReason === "MAX_TOKENS") truncated = true;
        }
        const token = candidate?.content?.parts?.[0]?.text;
        if (token) onToken(token);
      });

      return { truncated: truncated || !sawFinishSignal };
    } catch (err: unknown) {
      if (isAbortTimeoutError(err)) {
        throw new ExternalRequestTimeoutError("Gemini request");
      }
      throw err;
    }
  }
}
