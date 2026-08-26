import { Injectable } from "@nestjs/common";
import { type AiProvider } from "@prisma/client";

import { type AiAdvisorPort } from "./ai-advisor.port";
import { ClaudeAdvisorService } from "./claude-advisor.service";
import { GeminiAdvisorService } from "./gemini-advisor.service";
import { OpenAiAdvisorService } from "./openai-advisor.service";

/**
 * EPIC-023 G3 (D16) — builds the provider adapter PER REQUEST from the
 * caller's decrypted family key (never a process-wide DI binding resolved
 * once at boot from a server env var — see ai-advisor.module.ts's removed
 * `AI_ADVISOR_PORT` factory and ai-advisor.service.ts#streamChat).
 */
@Injectable()
export class AiAdvisorFactory {
  /**
   * `model` is the family's choice from Pengaturan; omitted or null means the
   * adapter falls back to the WealthMe default, which is what every family
   * had before the picker existed.
   */
  create(
    provider: AiProvider,
    apiKey: string,
    model?: string | null,
  ): AiAdvisorPort {
    switch (provider) {
      case "claude":
        return new ClaudeAdvisorService(apiKey, model);
      case "openai":
        return new OpenAiAdvisorService(apiKey, model);
      case "gemini":
        return new GeminiAdvisorService(apiKey, model);
      default: {
        const _exhaustiveCheck: never = provider;
        throw new Error(`Unknown AI provider: ${String(_exhaustiveCheck)}`);
      }
    }
  }
}
