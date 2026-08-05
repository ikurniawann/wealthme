import { AiAdvisorFactory } from "./ai-advisor-factory.service";
import { ClaudeAdvisorService } from "./claude-advisor.service";
import { GeminiAdvisorService } from "./gemini-advisor.service";
import { OpenAiAdvisorService } from "./openai-advisor.service";

describe("AiAdvisorFactory", () => {
  const factory = new AiAdvisorFactory();

  it("builds a ClaudeAdvisorService for provider 'claude'", () => {
    expect(factory.create("claude", "key")).toBeInstanceOf(
      ClaudeAdvisorService,
    );
  });

  it("builds an OpenAiAdvisorService for provider 'openai'", () => {
    expect(factory.create("openai", "key")).toBeInstanceOf(
      OpenAiAdvisorService,
    );
  });

  it("builds a GeminiAdvisorService for provider 'gemini'", () => {
    expect(factory.create("gemini", "key")).toBeInstanceOf(
      GeminiAdvisorService,
    );
  });
});
