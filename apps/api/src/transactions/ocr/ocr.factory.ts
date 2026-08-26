import { Injectable } from "@nestjs/common";
import { type AiProvider } from "@prisma/client";

import { ClaudeVisionOcrAdapter } from "./claude-vision-ocr.adapter";
import { GeminiVisionOcrAdapter } from "./gemini-vision-ocr.adapter";
import { OpenAiVisionOcrAdapter } from "./openai-vision-ocr.adapter";

import type { OcrPort } from "./ocr.port";

/**
 * EPIC-027 D11/D12 — builds the vision adapter PER REQUEST from the
 * caller's decrypted family key, exactly like `AiAdvisorFactory`. The old
 * `OCR_PORT` DI binding (a boot-time `ANTHROPIC_API_KEY` read that fell
 * back to `MockOcrService`) is gone: it meant every family's scan ran on
 * one server key, and when that key was unset a running server answered
 * scans with `Math.random()` amounts presented as a real receipt total.
 */
@Injectable()
export class OcrFactory {
  /**
   * `model` is the family's choice from Pengaturan; omitted or null falls
   * back to the WealthMe default.
   */
  create(provider: AiProvider, apiKey: string, model?: string | null): OcrPort {
    switch (provider) {
      case "claude":
        return new ClaudeVisionOcrAdapter(apiKey, model);
      case "openai":
        return new OpenAiVisionOcrAdapter(apiKey, model);
      case "gemini":
        return new GeminiVisionOcrAdapter(apiKey, model);
      default: {
        const _exhaustiveCheck: never = provider;
        throw new Error(`Unknown AI provider: ${String(_exhaustiveCheck)}`);
      }
    }
  }
}
