import { ClaudeVisionOcrAdapter } from "./claude-vision-ocr.adapter";
import { GeminiVisionOcrAdapter } from "./gemini-vision-ocr.adapter";
import { OcrFactory } from "./ocr.factory";
import { OpenAiVisionOcrAdapter } from "./openai-vision-ocr.adapter";

import type { AiProvider } from "@prisma/client";

describe("OcrFactory (EPIC-027 D12)", () => {
  const factory = new OcrFactory();

  it("builds a ClaudeVisionOcrAdapter for provider 'claude'", () => {
    expect(factory.create("claude", "key")).toBeInstanceOf(
      ClaudeVisionOcrAdapter,
    );
  });

  it("builds an OpenAiVisionOcrAdapter for provider 'openai'", () => {
    expect(factory.create("openai", "key")).toBeInstanceOf(
      OpenAiVisionOcrAdapter,
    );
  });

  it("builds a GeminiVisionOcrAdapter for provider 'gemini'", () => {
    expect(factory.create("gemini", "key")).toBeInstanceOf(
      GeminiVisionOcrAdapter,
    );
  });

  it("throws on an unknown provider rather than falling back to a default", () => {
    expect(() => factory.create("wingdings" as AiProvider, "key")).toThrow(
      /Unknown AI provider/,
    );
  });
});
