import { ExternalRequestTimeoutError } from "../common/utils/external-fetch.util";

import {
  AiAdvisorAuthError,
  AiAdvisorRateLimitError,
} from "./ai-advisor-provider.error";
import { GeminiAdvisorService } from "./gemini-advisor.service";

const CONTEXT = {
  familyGroupId: "fg-1",
  netWorth: 0n,
  monthlyIncome: 0n,
  monthlyExpense: 0n,
  totalAssets: 0n,
  totalLiabilities: 0n,
  topCategories: [],
};

function sseBody(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(`data: ${line}\n\n`));
      }
      controller.close();
    },
  });
}

/** EPIC-023 Task G retry (HIGH five-reviewer finding, round 2) — simulates a
 * timeout firing AFTER the response headers/first chunk arrive (mid-stream),
 * the exact case `fetchWithTimeout`'s own try/catch cannot classify because
 * it has already resolved by then. */
function abortingMidStreamBody(): ReadableStream<Uint8Array> {
  let pulled = false;
  return new ReadableStream({
    pull(controller) {
      if (!pulled) {
        pulled = true;
        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: "partial" }] } }] })}\n\n`,
          ),
        );
        return undefined;
      }
      return Promise.reject(
        new DOMException("The operation was aborted.", "AbortError"),
      );
    },
  });
}

describe("GeminiAdvisorService.chat", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("streams tokens, reports truncated:false on a normal STOP, and sends the key via header not the URL", async () => {
    const chunks = [
      JSON.stringify({
        candidates: [
          { content: { parts: [{ text: "Hi" }] }, finishReason: "STOP" },
        ],
      }),
    ];
    const fetchMock = jest
      .fn()
      .mockResolvedValue(new Response(sseBody(chunks), { status: 200 }));
    global.fetch = fetchMock;
    const service = new GeminiAdvisorService("test-key");
    const onToken = jest.fn();

    const result = await service.chat(CONTEXT, [], onToken);

    expect(onToken).toHaveBeenCalledWith("Hi");
    expect(result).toEqual({ truncated: false });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    // EPIC-023 Task G retry (MEDIUM finding) — the key must never land in
    // the URL query string (proxy/access logs); it goes in the header.
    expect(url).not.toContain("test-key");
    expect(url).not.toContain("key=");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe(
      "test-key",
    );
  });

  // The exact defect from the CRITICAL finding: hitting the token cap must
  // be reported as truncated, not indistinguishable from a natural stop.
  it("reports truncated:true on finishReason 'MAX_TOKENS'", async () => {
    const chunks = [
      JSON.stringify({
        candidates: [
          {
            content: { parts: [{ text: "cut off" }] },
            finishReason: "MAX_TOKENS",
          },
        ],
      }),
    ];
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response(sseBody(chunks), { status: 200 }));
    const service = new GeminiAdvisorService("test-key");

    const result = await service.chat(CONTEXT, [], jest.fn());

    expect(result).toEqual({ truncated: true });
  });

  // EPIC-023 Task G retry (CRITICAL five-reviewer finding, round 2) — a
  // stream that ends with NO `finishReason` at all (a clean-but-premature
  // close) must be reported as truncated, never as a natural stop.
  it("reports truncated:true when the stream ends with no finishReason at all", async () => {
    const chunks = [
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: "This looks done" }] } }],
      }),
    ];
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response(sseBody(chunks), { status: 200 }));
    const service = new GeminiAdvisorService("test-key");

    const result = await service.chat(CONTEXT, [], jest.fn());

    expect(result).toEqual({ truncated: true });
  });

  // EPIC-023 Task G retry (HIGH five-reviewer finding, round 2) — a timeout
  // firing mid-stream (after headers/first chunk arrive) must classify as
  // ExternalRequestTimeoutError instead of surfacing unclassified.
  it("classifies a timeout that fires mid-stream as ExternalRequestTimeoutError", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(abortingMidStreamBody(), { status: 200 }),
      );
    const service = new GeminiAdvisorService("test-key");

    await expect(service.chat(CONTEXT, [], jest.fn())).rejects.toThrow(
      ExternalRequestTimeoutError,
    );
  });

  it("skips a malformed chunk instead of crashing the stream", async () => {
    const chunks = [
      "not json",
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: "ok" }] } }],
      }),
    ];
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response(sseBody(chunks), { status: 200 }));
    const service = new GeminiAdvisorService("test-key");
    const onToken = jest.fn();

    await service.chat(CONTEXT, [], onToken);

    expect(onToken).toHaveBeenCalledWith("ok");
  });

  it("maps a 401 response to AiAdvisorAuthError", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response("unauthorized", { status: 401 }));
    const service = new GeminiAdvisorService("bad-key");

    await expect(service.chat(CONTEXT, [], jest.fn())).rejects.toThrow(
      AiAdvisorAuthError,
    );
  });

  it("maps a 429 response to AiAdvisorRateLimitError", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response("rate limited", { status: 429 }));
    const service = new GeminiAdvisorService("test-key");

    await expect(service.chat(CONTEXT, [], jest.fn())).rejects.toThrow(
      AiAdvisorRateLimitError,
    );
  });

  it("surfaces a timeout as ExternalRequestTimeoutError", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    const service = new GeminiAdvisorService("test-key");

    await expect(service.chat(CONTEXT, [], jest.fn())).rejects.toThrow(
      ExternalRequestTimeoutError,
    );
  });
});
