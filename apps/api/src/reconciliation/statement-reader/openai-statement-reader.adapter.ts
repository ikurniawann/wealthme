import { Injectable } from "@nestjs/common";
import { z } from "zod";

import {
  AiAdvisorAuthError,
  AiAdvisorRateLimitError,
} from "../../ai-advisor/ai-advisor-provider.error";
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

const OPENAI_CHAT_COMPLETIONS_URL =
  "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini" as const;
const MAX_TOKENS = 16_000;

const chatCompletionSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().nullable().optional() }),
      }),
    )
    .optional(),
});

/** EPIC-029 E5 — OpenAI statement reader. Non-streaming Chat Completions:
 * this is a single JSON extraction, so there is nothing to stream. */
@Injectable()
export class OpenAiStatementReaderAdapter implements StatementReaderPort {
  constructor(private readonly apiKey: string) {}

  async readStatement(statementText: string): Promise<StatementReading> {
    let res: Response;
    try {
      res = await fetchWithTimeout(
        OPENAI_CHAT_COMPLETIONS_URL,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            // Two turns, two roles: the rules are a `system` message, the
            // untrusted statement is the user message. See the prompt util.
            messages: [
              { role: "system", content: STATEMENT_SYSTEM_PROMPT },
              {
                role: "user",
                content: buildStatementUserMessage(statementText),
              },
            ],
          }),
        },
        STATEMENT_READER_TIMEOUT_MS,
        "OpenAI statement request",
      );
    } catch (err: unknown) {
      if (isAbortTimeoutError(err)) {
        throw new ExternalRequestTimeoutError("OpenAI statement request");
      }
      throw err;
    }

    if (!res.ok) {
      // The body is read but never surfaced to the client — it can quote the
      // request, and therefore the statement, back at us.
      const body = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403) {
        throw new AiAdvisorAuthError("OpenAI");
      }
      if (res.status === 429) {
        throw new AiAdvisorRateLimitError("OpenAI");
      }
      throw new Error(
        `OpenAI statement request failed (${res.status}): ${body.slice(0, 200)}`,
      );
    }

    let payload: unknown;
    try {
      payload = await res.json();
    } catch {
      throw new StatementReaderParseError("upstream body was not JSON");
    }

    const parsed = chatCompletionSchema.safeParse(payload);
    const content = parsed.success
      ? parsed.data.choices?.[0]?.message.content
      : null;
    if (!content) throw new StatementReaderParseError("empty completion");

    return parseStatementResponseText(content);
  }
}
