/* eslint-disable import/order -- the ClaudeAdvisorService import below is
 * deliberately placed AFTER jest.mock("@anthropic-ai/sdk", ...) (Jest hoists
 * jest.mock calls above imports at transform time, but that hoisting isn't
 * visible to eslint's static import-order check, which otherwise flags the
 * scattered import groups this file's mocking technique requires). */
import { ExternalRequestTimeoutError } from "../common/utils/external-fetch.util";
import {
  AiAdvisorAuthError,
  AiAdvisorRateLimitError,
} from "./ai-advisor-provider.error";

// EPIC-023 Task G retry (CRITICAL five-reviewer finding) — ClaudeAdvisorService
// had zero test coverage for the exact defect the finding names: a response
// that hits `max_tokens` must be reported as TRUNCATED, not silently treated
// as a complete answer. Mocks the whole `@anthropic-ai/sdk` module — the
// service constructs its own `new Anthropic(...)` client internally, so this
// is the only seam available without changing its constructor signature.
jest.mock("@anthropic-ai/sdk", () => {
  class APIConnectionTimeoutError extends Error {}
  class AuthenticationError extends Error {}
  class RateLimitError extends Error {}

  const streamMock = jest.fn();

  class MockAnthropic {
    static APIConnectionTimeoutError = APIConnectionTimeoutError;
    static AuthenticationError = AuthenticationError;
    static RateLimitError = RateLimitError;
    messages = { stream: streamMock };
    constructor(_opts: unknown) {}
  }

  return { __esModule: true, default: MockAnthropic, __streamMock: streamMock };
});

const { __streamMock } = jest.requireMock("@anthropic-ai/sdk") as {
  __streamMock: jest.Mock;
};

import { ClaudeAdvisorService } from "./claude-advisor.service";

function eventStream(events: unknown[]) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const e of events) yield e;
    },
  };
}

const CONTEXT = {
  familyGroupId: "fg-1",
  netWorth: 0n,
  monthlyIncome: 0n,
  monthlyExpense: 0n,
  totalAssets: 0n,
  totalLiabilities: 0n,
  topCategories: [],
};

describe("ClaudeAdvisorService.chat", () => {
  beforeEach(() => {
    __streamMock.mockReset();
  });

  it("streams tokens and reports truncated:false on a normal end_turn stop", async () => {
    __streamMock.mockReturnValue(
      eventStream([
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Hello" },
        },
        { type: "message_delta", delta: { stop_reason: "end_turn" } },
      ]),
    );
    const service = new ClaudeAdvisorService("test-key");
    const onToken = jest.fn();

    const result = await service.chat(CONTEXT, [], onToken);

    expect(onToken).toHaveBeenCalledWith("Hello");
    expect(result).toEqual({ truncated: false });
  });

  // The exact defect: a response cut off by max_tokens must be reported as
  // truncated, not indistinguishable from a complete answer.
  it("reports truncated:true when the stream stops with stop_reason max_tokens", async () => {
    __streamMock.mockReturnValue(
      eventStream([
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "This answer got cut" },
        },
        { type: "message_delta", delta: { stop_reason: "max_tokens" } },
      ]),
    );
    const service = new ClaudeAdvisorService("test-key");

    const result = await service.chat(CONTEXT, [], jest.fn());

    expect(result).toEqual({ truncated: true });
  });

  // EPIC-023 Task G retry (CRITICAL five-reviewer finding, round 2) — the
  // exact defect a reviewer proved by execution: a stream that ends cleanly
  // but PREMATURELY (no hard connection error, but also no `message_delta`
  // terminal event — what a proxy/load-balancer idle timeout produces) must
  // be reported as truncated, not as a clean `done`.
  it("reports truncated:true when the stream ends with no message_delta terminal event at all", async () => {
    __streamMock.mockReturnValue(
      eventStream([
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "This looks complete but isn't" },
        },
        // No `message_delta` event follows — the stream just ends here.
      ]),
    );
    const service = new ClaudeAdvisorService("test-key");

    const result = await service.chat(CONTEXT, [], jest.fn());

    expect(result).toEqual({ truncated: true });
  });

  it("maps a connection timeout to ExternalRequestTimeoutError", async () => {
    const { __streamMock: mockRef } = jest.requireMock("@anthropic-ai/sdk") as {
      __streamMock: jest.Mock;
    };
    const AnthropicMock = (await import("@anthropic-ai/sdk"))
      .default as unknown as {
      APIConnectionTimeoutError: new (msg?: string) => Error;
    };
    mockRef.mockImplementation(() => {
      throw new AnthropicMock.APIConnectionTimeoutError("timed out");
    });
    const service = new ClaudeAdvisorService("test-key");

    await expect(service.chat(CONTEXT, [], jest.fn())).rejects.toThrow(
      ExternalRequestTimeoutError,
    );
  });

  it("maps an authentication failure to AiAdvisorAuthError", async () => {
    const AnthropicMock = (await import("@anthropic-ai/sdk"))
      .default as unknown as {
      AuthenticationError: new (msg?: string) => Error;
    };
    __streamMock.mockImplementation(() => {
      throw new AnthropicMock.AuthenticationError("invalid key");
    });
    const service = new ClaudeAdvisorService("test-key");

    await expect(service.chat(CONTEXT, [], jest.fn())).rejects.toThrow(
      AiAdvisorAuthError,
    );
  });

  it("maps a rate-limit failure to AiAdvisorRateLimitError", async () => {
    const AnthropicMock = (await import("@anthropic-ai/sdk"))
      .default as unknown as {
      RateLimitError: new (msg?: string) => Error;
    };
    __streamMock.mockImplementation(() => {
      throw new AnthropicMock.RateLimitError("rate limited");
    });
    const service = new ClaudeAdvisorService("test-key");

    await expect(service.chat(CONTEXT, [], jest.fn())).rejects.toThrow(
      AiAdvisorRateLimitError,
    );
  });
});
