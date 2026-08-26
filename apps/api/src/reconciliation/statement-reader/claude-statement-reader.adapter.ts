import Anthropic from "@anthropic-ai/sdk";
import { Injectable } from "@nestjs/common";

import {
  AiAdvisorAuthError,
  AiAdvisorRateLimitError,
} from "../../ai-advisor/ai-advisor-provider.error";
import { ExternalRequestTimeoutError } from "../../common/utils/external-fetch.util";

import {
  STATEMENT_SYSTEM_PROMPT,
  buildStatementUserMessage,
  parseStatementResponseText,
} from "./statement-reader-prompt.util";

import type {
  StatementReaderPort,
  StatementReading,
} from "./statement-reader.port";

const CLAUDE_STATEMENT_MODEL = "claude-haiku-4-5-20251001" as const;
/** A month of transactions is a long table: the receipt-OCR budget of 512
 * tokens would truncate it into a silently short statement. Sized for
 * `MAX_STATEMENT_ROWS` worth of compact JSON rows. */
const MAX_TOKENS = 16_000;
/**
 * Sized to the REQUEST PATH, not to what the model might want.
 *
 * This was 120s, which could never work: nginx cuts an idle upstream at 60s
 * by default and Cloudflare caps a single request at ~100s, so the API's own
 * carefully-coded `504 STATEMENT_AI_TIMEOUT` was raised a full minute after
 * the browser had already been disconnected. The user saw nothing at all.
 *
 * A budget only helps if it expires BEFORE the proxies give up, so this sits
 * under the tightest of them. Reads are per page now (see
 * `ReadStatementPdfPageDto`), which is roughly ten rows and finishes far
 * inside this — the budget is a backstop for a stalled upstream, not the
 * normal case.
 */
export const STATEMENT_READER_TIMEOUT_MS = 55_000;

/**
 * EPIC-029 E5 — Claude statement reader, built PER REQUEST from the family's
 * own decrypted AI key by `StatementReaderFactory` (never a boot-time DI
 * binding on a server env var). Shares `STATEMENT_SYSTEM_PROMPT` and
 * `statementReadingSchema` with the OpenAI and Gemini adapters.
 */
@Injectable()
export class ClaudeStatementReaderAdapter implements StatementReaderPort {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey,
      timeout: STATEMENT_READER_TIMEOUT_MS,
    });
  }

  async readStatement(statementText: string): Promise<StatementReading> {
    let message: Anthropic.Message;
    try {
      message = await this.client.messages.create({
        model: CLAUDE_STATEMENT_MODEL,
        max_tokens: MAX_TOKENS,
        // The rules ride Anthropic's own top-level `system` parameter — a
        // real role boundary — and the untrusted statement is the user turn.
        // Never both in one turn: see the prompt util's header.
        system: STATEMENT_SYSTEM_PROMPT,
        messages: [
          { role: "user", content: buildStatementUserMessage(statementText) },
        ],
      });
    } catch (err: unknown) {
      // Typed failures, mirroring ClaudeVisionOcrAdapter, so the controller
      // can tell "your key was rejected" from "rate limited" from "took too
      // long". The SDK's own error text never becomes the client message.
      if (err instanceof Anthropic.APIConnectionTimeoutError) {
        throw new ExternalRequestTimeoutError("Claude statement request");
      }
      if (err instanceof Anthropic.AuthenticationError) {
        throw new AiAdvisorAuthError("Claude");
      }
      if (err instanceof Anthropic.RateLimitError) {
        throw new AiAdvisorRateLimitError("Claude");
      }
      throw err;
    }

    const text =
      message.content[0]?.type === "text" ? message.content[0].text : "";
    return parseStatementResponseText(text);
  }
}
