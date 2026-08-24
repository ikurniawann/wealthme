/* eslint-disable import/order -- the ClaudeVisionOcrAdapter import below is
 * deliberately placed AFTER jest.mock("@anthropic-ai/sdk", ...) (Jest hoists
 * jest.mock above imports at transform time, but that hoisting is invisible
 * to eslint's static import-order check). Same technique as
 * ai-advisor/claude-advisor.service.spec.ts. */
import {
  AiAdvisorAuthError,
  AiAdvisorRateLimitError,
} from "../../ai-advisor/ai-advisor-provider.error";
import { ExternalRequestTimeoutError } from "../../common/utils/external-fetch.util";

import { OcrParseError } from "./ocr-parse.error";

// The adapter constructs its own `new Anthropic(...)` client, so mocking the
// whole SDK module is the only seam that does not change its constructor.
jest.mock("@anthropic-ai/sdk", () => {
  class APIConnectionTimeoutError extends Error {}
  class AuthenticationError extends Error {}
  class RateLimitError extends Error {}

  const createMock = jest.fn();

  class MockAnthropic {
    static APIConnectionTimeoutError = APIConnectionTimeoutError;
    static AuthenticationError = AuthenticationError;
    static RateLimitError = RateLimitError;
    messages = { create: createMock };
    constructor(_opts: unknown) {}
  }

  return { __esModule: true, default: MockAnthropic, __createMock: createMock };
});

const { __createMock } = jest.requireMock("@anthropic-ai/sdk") as {
  __createMock: jest.Mock;
};
const MockAnthropic = (
  jest.requireMock("@anthropic-ai/sdk") as {
    default: {
      APIConnectionTimeoutError: new (m: string) => Error;
      AuthenticationError: new (m: string) => Error;
      RateLimitError: new (m: string) => Error;
    };
  }
).default;

import { ClaudeVisionOcrAdapter } from "./claude-vision-ocr.adapter";

const API_KEY = "sk-ant-family-secret";
const IMAGE = "aGVsbG8=";

function textMessage(text: string) {
  return { content: [{ type: "text", text }] };
}

const VALID_JSON = JSON.stringify({
  amount: 45000,
  description: "Indomaret",
  occurredAt: "2026-02-01T10:00:00.000Z",
  categoryHint: "Belanja",
});

/** Every thrown error must be safe to surface: the family's decrypted key can
 *  never appear in a message the controller might log or map. */
async function expectNoKeyLeak(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (err) {
    expect((err as Error).message).not.toContain(API_KEY);
    return err as Error;
  }
  throw new Error("expected the adapter to throw");
}

describe("ClaudeVisionOcrAdapter (EPIC-027 D12)", () => {
  let adapter: ClaudeVisionOcrAdapter;

  beforeEach(() => {
    __createMock.mockReset();
    adapter = new ClaudeVisionOcrAdapter(API_KEY);
  });

  it("returns the validated result and sends the image as a base64 source", async () => {
    __createMock.mockResolvedValue(textMessage(VALID_JSON));

    await expect(adapter.extractTransaction(IMAGE)).resolves.toEqual({
      amount: 45000,
      description: "Indomaret",
      occurredAt: "2026-02-01T10:00:00.000Z",
      categoryHint: "Belanja",
    });

    const request = __createMock.mock.calls[0]?.[0] as {
      messages: [
        { content: [{ source: { data: string; media_type: string } }] },
      ];
    };
    expect(request.messages[0].content[0].source).toEqual({
      type: "base64",
      media_type: "image/jpeg",
      data: IMAGE,
    });
  });

  it("maps a connection timeout to ExternalRequestTimeoutError", async () => {
    __createMock.mockRejectedValue(
      new MockAnthropic.APIConnectionTimeoutError(`timed out for ${API_KEY}`),
    );

    const err = await expectNoKeyLeak(adapter.extractTransaction(IMAGE));
    expect(err).toBeInstanceOf(ExternalRequestTimeoutError);
  });

  it("maps a rejected key to AiAdvisorAuthError without echoing the key", async () => {
    __createMock.mockRejectedValue(
      new MockAnthropic.AuthenticationError(`invalid x-api-key ${API_KEY}`),
    );

    const err = await expectNoKeyLeak(adapter.extractTransaction(IMAGE));
    expect(err).toBeInstanceOf(AiAdvisorAuthError);
  });

  it("maps a 429 to AiAdvisorRateLimitError", async () => {
    __createMock.mockRejectedValue(
      new MockAnthropic.RateLimitError("rate limited"),
    );

    const err = await expectNoKeyLeak(adapter.extractTransaction(IMAGE));
    expect(err).toBeInstanceOf(AiAdvisorRateLimitError);
  });

  it("throws OcrParseError when the model answers with prose instead of JSON", async () => {
    __createMock.mockResolvedValue(textMessage("I cannot read that receipt."));

    const err = await expectNoKeyLeak(adapter.extractTransaction(IMAGE));
    expect(err).toBeInstanceOf(OcrParseError);
  });

  it("throws OcrParseError when the answer violates the shared schema", async () => {
    __createMock.mockResolvedValue(
      textMessage(VALID_JSON.replace("45000", '"empat puluh lima ribu"')),
    );

    await expect(adapter.extractTransaction(IMAGE)).rejects.toBeInstanceOf(
      OcrParseError,
    );
  });

  it("throws OcrParseError when the message carries no text block at all", async () => {
    __createMock.mockResolvedValue({ content: [] });

    await expect(adapter.extractTransaction(IMAGE)).rejects.toBeInstanceOf(
      OcrParseError,
    );
  });
});
