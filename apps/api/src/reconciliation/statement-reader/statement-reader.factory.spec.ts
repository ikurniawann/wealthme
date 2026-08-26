import { ClaudeStatementReaderAdapter } from "./claude-statement-reader.adapter";
import { GeminiStatementReaderAdapter } from "./gemini-statement-reader.adapter";
import { OpenAiStatementReaderAdapter } from "./openai-statement-reader.adapter";
import { StatementReaderFactory } from "./statement-reader.factory";

describe("StatementReaderFactory", () => {
  const factory = new StatementReaderFactory();

  it("builds the adapter matching the family's configured provider", () => {
    expect(factory.create("claude", "k")).toBeInstanceOf(
      ClaudeStatementReaderAdapter,
    );
    expect(factory.create("openai", "k")).toBeInstanceOf(
      OpenAiStatementReaderAdapter,
    );
    expect(factory.create("gemini", "k")).toBeInstanceOf(
      GeminiStatementReaderAdapter,
    );
  });

  it("throws on an unknown provider instead of silently picking one", () => {
    // E5 — there is no default and no mock. A provider this factory does not
    // know is a bug to surface, not a reason to answer with invented rows.
    expect(() => factory.create("unknown" as never, "k")).toThrow(
      /Unknown AI provider/,
    );
  });
});
