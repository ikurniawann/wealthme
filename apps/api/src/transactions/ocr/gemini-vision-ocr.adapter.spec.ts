import {
  AiAdvisorAuthError,
  AiAdvisorRateLimitError,
} from "../../ai-advisor/ai-advisor-provider.error";
import { ExternalRequestTimeoutError } from "../../common/utils/external-fetch.util";

import { GeminiVisionOcrAdapter } from "./gemini-vision-ocr.adapter";
import { OcrParseError } from "./ocr-parse.error";

const API_KEY = "AIza-family-secret";
const IMAGE = "aGVsbG8=";

const VALID_JSON = JSON.stringify({
  amount: 45000,
  description: "Indomaret",
  occurredAt: "2026-02-01T10:00:00.000Z",
  categoryHint: "Belanja",
});

function response(payload: unknown, status = 200): Response {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () =>
      typeof payload === "string"
        ? Promise.reject(new SyntaxError("not JSON"))
        : Promise.resolve(payload),
    text: () => Promise.resolve(body),
  } as unknown as Response;
}

function candidate(text: string): unknown {
  return { candidates: [{ content: { parts: [{ text }] } }] };
}

/** The family's decrypted key must never reach a thrown message. */
async function expectNoKeyLeak(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (err) {
    expect((err as Error).message).not.toContain(API_KEY);
    return err as Error;
  }
  throw new Error("expected the adapter to throw");
}

describe("GeminiVisionOcrAdapter (EPIC-027 D12)", () => {
  const originalFetch = global.fetch;
  const adapter = new GeminiVisionOcrAdapter(API_KEY);

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns the validated result and sends the image as an inline_data part", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(response(candidate(VALID_JSON)));
    global.fetch = fetchMock;

    await expect(adapter.extractTransaction(IMAGE)).resolves.toEqual({
      amount: 45000,
      description: "Indomaret",
      occurredAt: "2026-02-01T10:00:00.000Z",
      categoryHint: "Belanja",
    });

    const init = fetchMock.mock.calls[0]?.[1] as {
      body: string;
      headers: Record<string, string>;
    };
    expect(JSON.parse(init.body).contents[0].parts[0].inline_data).toEqual({
      mime_type: "image/jpeg",
      data: IMAGE,
    });
    // The key travels in the header, never the query string, so it cannot
    // land in a proxy/access log.
    expect(init.headers["x-goog-api-key"]).toBe(API_KEY);
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain(API_KEY);
  });

  it("throws OcrParseError when the response body is not JSON at all", async () => {
    global.fetch = jest.fn().mockResolvedValue(response("<html>502</html>"));

    const err = await expectNoKeyLeak(adapter.extractTransaction(IMAGE));
    expect(err).toBeInstanceOf(OcrParseError);
  });

  it("throws OcrParseError when the envelope carries no candidate text", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        response({ candidates: [{ content: { parts: [] } }] }),
      );

    await expect(adapter.extractTransaction(IMAGE)).rejects.toBeInstanceOf(
      OcrParseError,
    );
  });

  it("throws OcrParseError when the envelope is reshaped entirely", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(response({ somethingElse: true }));

    await expect(adapter.extractTransaction(IMAGE)).rejects.toBeInstanceOf(
      OcrParseError,
    );
  });

  it("throws OcrParseError when the candidate text violates the shared schema", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        response(candidate(VALID_JSON.replace("45000", "-1"))),
      );

    await expect(adapter.extractTransaction(IMAGE)).rejects.toBeInstanceOf(
      OcrParseError,
    );
  });

  it("maps 403 to AiAdvisorAuthError without echoing the key", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        response({ error: { message: `API key not valid: ${API_KEY}` } }, 403),
      );

    const err = await expectNoKeyLeak(adapter.extractTransaction(IMAGE));
    expect(err).toBeInstanceOf(AiAdvisorAuthError);
  });

  it("reports a per-day quota exhaustion as a daily rate limit with no retry delay", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      response(
        {
          error: {
            message: "Quota exceeded",
            details: [
              {
                "@type": "type.googleapis.com/google.rpc.QuotaFailure",
                violations: [
                  {
                    quotaId:
                      "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
                  },
                ],
              },
              {
                "@type": "type.googleapis.com/google.rpc.RetryInfo",
                retryDelay: "23s",
              },
            ],
          },
        },
        429,
      ),
    );

    const err = (await expectNoKeyLeak(
      adapter.extractTransaction(IMAGE),
    )) as AiAdvisorRateLimitError;
    expect(err).toBeInstanceOf(AiAdvisorRateLimitError);
    expect(err.scope).toBe("daily");
    // A per-day cap does not reset in 23 seconds — telling the user to retry
    // shortly is the exact lie parseGeminiRateLimit exists to remove.
    expect(err.retryAfterSeconds).toBeUndefined();
  });

  it("still reports a plain rate limit when the 429 body is unparseable", async () => {
    global.fetch = jest.fn().mockResolvedValue(response("nope", 429));

    const err = (await expectNoKeyLeak(
      adapter.extractTransaction(IMAGE),
    )) as AiAdvisorRateLimitError;
    expect(err).toBeInstanceOf(AiAdvisorRateLimitError);
    expect(err.scope).toBeUndefined();
  });

  it("maps an aborted request to ExternalRequestTimeoutError", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(
        new DOMException("The operation timed out.", "TimeoutError"),
      );

    const err = await expectNoKeyLeak(adapter.extractTransaction(IMAGE));
    expect(err).toBeInstanceOf(ExternalRequestTimeoutError);
  });
});
