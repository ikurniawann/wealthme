import { Injectable, Logger } from "@nestjs/common";
import { z } from "zod";

import { AiAdvisorAuthError } from "../../ai-advisor/ai-advisor-provider.error";
import { parseGeminiRateLimit } from "../../ai-advisor/gemini-advisor.service";
import {
  ExternalRequestTimeoutError,
  fetchWithTimeout,
  isAbortTimeoutError,
} from "../../common/utils/external-fetch.util";

import { STATEMENT_READER_TIMEOUT_MS } from "./claude-statement-reader.adapter";
import { StatementReaderParseError } from "./statement-reader-parse.error";
import {
  STATEMENT_SYSTEM_PROMPT,
  buildStatementUserMessage,
  parseStatementResponseText,
} from "./statement-reader-prompt.util";

import type {
  StatementReaderPort,
  StatementReading,
} from "./statement-reader.port";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
// Same override reasoning as GeminiAdvisorService: Google retires model ids,
// and the newest model carries the tightest free quota.
const GEMINI_STATEMENT_MODEL =
  process.env.GEMINI_STATEMENT_MODEL?.trim() ||
  process.env.GEMINI_MODEL?.trim() ||
  "gemini-2.5-flash";

/** ~10 rows per page in compact JSON, with 20x headroom. */
const MAX_OUTPUT_TOKENS = 8192;

const geminiResponseSchema = z.object({
  /** Google reports thinking tokens separately. Logged (never returned) so a
   *  slow read can be diagnosed as "the model thought for 40s" rather than
   *  guessed at from the outside — which is exactly what had to be done the
   *  first time this timed out. */
  usageMetadata: z
    .object({
      promptTokenCount: z.number().optional(),
      candidatesTokenCount: z.number().optional(),
      thoughtsTokenCount: z.number().optional(),
    })
    .optional(),
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
      }),
    )
    .optional(),
});

/**
 * EPIC-029 E5 — Gemini statement reader. The API key travels in the
 * `x-goog-api-key` header rather than the query string so it cannot land in
 * proxy/access logs (same reasoning as GeminiAdvisorService).
 */
@Injectable()
export class GeminiStatementReaderAdapter implements StatementReaderPort {
  private readonly logger = new Logger(GeminiStatementReaderAdapter.name);

  constructor(private readonly apiKey: string) {}

  async readStatement(statementText: string): Promise<StatementReading> {
    const url = `${GEMINI_API_BASE}/models/${GEMINI_STATEMENT_MODEL}:generateContent`;

    let res: Response;
    try {
      res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.apiKey,
          },
          body: JSON.stringify({
            // Google's own system channel, same as GeminiAdvisorService uses
            // for the advisor prompt — not another line prepended to the user
            // turn. See the prompt util.
            systemInstruction: {
              parts: [{ text: STATEMENT_SYSTEM_PROMPT }],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: buildStatementUserMessage(statementText) }],
              },
            ],
            generationConfig: {
              // This request had NO generationConfig at all, and it cost a
              // production timeout: `gemini-2.5-flash` does DYNAMIC THINKING
              // by default, so the model could spend the entire 55s budget
              // reasoning before emitting a single row. The observed failure
              // was `ms=55001 err=ExternalRequestTimeoutError` on a single
              // page of ~2KB — far too long for ten rows of transcription.
              //
              // Transcription needs no reasoning: every rule is mechanical
              // ("copy the amount character-for-character"), so the thinking
              // budget is zero. Only the 2.5 FLASH family allows disabling it
              // outright — 2.5 Pro rejects `thinkingBudget: 0` with a 400 —
              // and the model id is env-overridable, so this is applied by
              // name rather than assumed.
              ...(/^gemini-2\.5-flash/.test(GEMINI_STATEMENT_MODEL)
                ? { thinkingConfig: { thinkingBudget: 0 } }
                : {}),
              // Ask for JSON directly instead of hoping prose does not appear
              // around it. `parseStatementResponseText` still strips a fence
              // if one shows up — belt and braces, since the model id can be
              // overridden to one that ignores this.
              responseMimeType: "application/json",
              // Transcription is not a creative task; the same page must read
              // the same way twice.
              temperature: 0,
              // A page of a personal statement is ~10 rows. This is ~20x that
              // and bounds a runaway generation, which would otherwise burn
              // the whole timeout AND the family's quota.
              maxOutputTokens: MAX_OUTPUT_TOKENS,
            },
          }),
        },
        STATEMENT_READER_TIMEOUT_MS,
        "Gemini statement request",
      );
    } catch (err: unknown) {
      if (isAbortTimeoutError(err)) {
        throw new ExternalRequestTimeoutError("Gemini statement request");
      }
      throw err;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403) {
        throw new AiAdvisorAuthError("Gemini");
      }
      if (res.status === 429) {
        // Google states WHICH quota ran out in the body — reuse the advisor's
        // parser so a per-day cap is not reported as "try again shortly".
        throw parseGeminiRateLimit(body);
      }
      throw new Error(
        `Gemini statement request failed (${res.status}): ${body.slice(0, 200)}`,
      );
    }

    let payload: unknown;
    try {
      payload = await res.json();
    } catch {
      throw new StatementReaderParseError("upstream body was not JSON");
    }

    const parsed = geminiResponseSchema.safeParse(payload);
    const usage = parsed.success ? parsed.data.usageMetadata : undefined;
    if (usage) {
      this.logger.log(
        `gemini statement usage: model=${GEMINI_STATEMENT_MODEL} prompt=${
          usage.promptTokenCount ?? "?"
        } output=${usage.candidatesTokenCount ?? "?"} thoughts=${
          usage.thoughtsTokenCount ?? 0
        }`,
      );
    }
    const text = parsed.success
      ? parsed.data.candidates?.[0]?.content?.parts?.[0]?.text
      : undefined;
    if (!text) throw new StatementReaderParseError("empty completion");

    return parseStatementResponseText(text);
  }
}
