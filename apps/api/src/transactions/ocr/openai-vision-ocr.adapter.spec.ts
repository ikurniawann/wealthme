import {
  AiAdvisorAuthError,
  AiAdvisorRateLimitError,
} from "../../ai-advisor/ai-advisor-provider.error";
import { ExternalRequestTimeoutError } from "../../common/utils/external-fetch.util";

import { OcrParseError } from "./ocr-parse.error";
import { OpenAiVisionOcrAdapter } from "./openai-vision-ocr.adapter";

const IMAGE = "aGVsbG8=";

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(payload),
    text: () => Promise.resolve(JSON.stringify(payload)),
  } as unknown as Response;
}

function completion(content: string): unknown {
  return { choices: [{ message: { content } }] };
}

describe("OpenAiVisionOcrAdapter (EPIC-027 D12)", () => {
  const originalFetch = global.fetch;
  const adapter = new OpenAiVisionOcrAdapter("sk-family");

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns the validated result and sends the image as a data URL", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse(
        completion(
          JSON.stringify({
            amount: 45000,
            description: "Indomaret",
            occurredAt: "2026-02-01T10:00:00.000Z",
            categoryHint: "Belanja",
          }),
        ),
      ),
    );
    global.fetch = fetchMock;

    await expect(adapter.extractTransaction(IMAGE)).resolves.toEqual({
      amount: 45000,
      description: "Indomaret",
      occurredAt: "2026-02-01T10:00:00.000Z",
      categoryHint: "Belanja",
    });
    const body = String(
      (fetchMock.mock.calls[0]?.[1] as { body: string } | undefined)?.body,
    );
    expect(body).toContain(`data:image/jpeg;base64,${IMAGE}`);
  });

  it("throws OcrParseError when the model answers with prose instead of JSON", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse(completion("I cannot read that.")));

    await expect(adapter.extractTransaction(IMAGE)).rejects.toThrow(
      OcrParseError,
    );
  });

  it("throws OcrParseError when the completion violates the shared schema", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(
        completion(
          JSON.stringify({
            amount: "empat puluh lima ribu",
            description: "Indomaret",
            occurredAt: "2026-02-01T10:00:00.000Z",
            categoryHint: "Belanja",
          }),
        ),
      ),
    );

    await expect(adapter.extractTransaction(IMAGE)).rejects.toThrow(
      OcrParseError,
    );
  });

  it("throws OcrParseError on an empty completion rather than crashing", async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ choices: [] }));

    await expect(adapter.extractTransaction(IMAGE)).rejects.toThrow(
      OcrParseError,
    );
  });

  it("maps 401 to AiAdvisorAuthError", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ error: "bad key" }, 401));

    await expect(adapter.extractTransaction(IMAGE)).rejects.toThrow(
      AiAdvisorAuthError,
    );
  });

  it("maps 429 to AiAdvisorRateLimitError", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ error: "slow down" }, 429));

    await expect(adapter.extractTransaction(IMAGE)).rejects.toThrow(
      AiAdvisorRateLimitError,
    );
  });

  it("maps an aborted request to ExternalRequestTimeoutError", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(
        new DOMException("The operation timed out.", "TimeoutError"),
      );

    await expect(adapter.extractTransaction(IMAGE)).rejects.toThrow(
      ExternalRequestTimeoutError,
    );
  });
});
