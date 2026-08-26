import { Injectable } from "@nestjs/common";
import { type AiProvider } from "@prisma/client";

import { ClaudeStatementReaderAdapter } from "./claude-statement-reader.adapter";
import { GeminiStatementReaderAdapter } from "./gemini-statement-reader.adapter";
import { OpenAiStatementReaderAdapter } from "./openai-statement-reader.adapter";

import type { StatementReaderPort } from "./statement-reader.port";

/**
 * EPIC-029 E5 — builds the statement reader PER REQUEST from the caller's
 * decrypted family key, exactly like `OcrFactory` and `AiAdvisorFactory`.
 * There is deliberately no DI binding to bind: a process-wide key would mean
 * one family's statement read is billed to another, and a mock fallback
 * would answer with an invented table of money rows.
 */
@Injectable()
export class StatementReaderFactory {
  /**
   * `model` is the family's choice from Pengaturan; omitted or null falls
   * back to the WealthMe default.
   */
  create(
    provider: AiProvider,
    apiKey: string,
    model?: string | null,
  ): StatementReaderPort {
    switch (provider) {
      case "claude":
        return new ClaudeStatementReaderAdapter(apiKey, model);
      case "openai":
        return new OpenAiStatementReaderAdapter(apiKey, model);
      case "gemini":
        return new GeminiStatementReaderAdapter(apiKey, model);
      default: {
        const _exhaustiveCheck: never = provider;
        throw new Error(`Unknown AI provider: ${String(_exhaustiveCheck)}`);
      }
    }
  }
}
