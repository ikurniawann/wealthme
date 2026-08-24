import { Injectable } from "@nestjs/common";
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

const geminiResponseSchema = z.object({
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
    const text = parsed.success
      ? parsed.data.candidates?.[0]?.content?.parts?.[0]?.text
      : undefined;
    if (!text) throw new StatementReaderParseError("empty completion");

    return parseStatementResponseText(text);
  }
}
