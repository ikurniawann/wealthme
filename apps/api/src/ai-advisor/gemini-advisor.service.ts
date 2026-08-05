import { Injectable } from "@nestjs/common";
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

const GEMINI_MODEL = "gemini-2.0-flash" as const;
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
@Injectable()
export class GeminiAdvisorService extends AiAdvisorPort {
  constructor(private readonly apiKey: string) {
    super();
  }

  async chat(
    context: AdvisorContext,
    messages: AdvisorMessage[],
    onToken: (token: string) => void,
  ): Promise<AdvisorChatResult> {
    const url = `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`;

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
            systemInstruction: {
              parts: [{ text: buildAdvisorSystemPrompt(context) }],
            },
            contents: messages.map((m) => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }],
            })),
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
          throw new AiAdvisorRateLimitError("Gemini");
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
