import { ExternalRequestTimeoutError } from "../common/utils/external-fetch.util";

import {
  AiAdvisorAuthError,
  AiAdvisorRateLimitError,
} from "./ai-advisor-provider.error";
import { OpenAiAdvisorService } from "./openai-advisor.service";

const CONTEXT = {
  familyGroupId: "fg-1",
  netWorth: 0n,
  monthlyIncome: 0n,
  monthlyExpense: 0n,
  totalAssets: 0n,
  totalLiabilities: 0n,
  topCategories: [],
  liabilities: [],
  assets: [],
  accounts: [],
  goals: [],
  truncatedLists: false,
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
 * it has already resolved by then. Verified directly against Node's real
 * `Readable.fromWeb` bridge: a `pull()` rejection with an AbortError-shaped
 * `DOMException` propagates out of the `for await` in `consumeSseStream`. */
function abortingMidStreamBody(): ReadableStream<Uint8Array> {
  let pulled = false;
  return new ReadableStream({
    pull(controller) {
      if (!pulled) {
        pulled = true;
        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({ choices: [{ delta: { content: "partial" } }] })}\n\n`,
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

describe("OpenAiAdvisorService.chat", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("streams tokens and reports truncated:false on finish_reason 'stop'", async () => {
    const chunks = [
      JSON.stringify({ choices: [{ delta: { content: "Hi" } }] }),
      JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] }),
      "[DONE]",
    ];
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response(sseBody(chunks), { status: 200 }));
    const service = new OpenAiAdvisorService("test-key");
    const onToken = jest.fn();

    const result = await service.chat(CONTEXT, [], onToken);

    expect(onToken).toHaveBeenCalledWith("Hi");
    expect(result).toEqual({ truncated: false });
  });

  // The exact defect from the CRITICAL finding: hitting the token cap must
  // be reported as truncated, not indistinguishable from a natural stop.
  it("reports truncated:true on finish_reason 'length'", async () => {
    const chunks = [
      JSON.stringify({ choices: [{ delta: { content: "This got cut" } }] }),
      JSON.stringify({ choices: [{ delta: {}, finish_reason: "length" }] }),
      "[DONE]",
    ];
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response(sseBody(chunks), { status: 200 }));
    const service = new OpenAiAdvisorService("test-key");

    const result = await service.chat(CONTEXT, [], jest.fn());

    expect(result).toEqual({ truncated: true });
  });

  // EPIC-023 Task G retry (CRITICAL five-reviewer finding, round 2) — a
  // stream that ends with NO `finish_reason` at all (a clean-but-premature
  // close — e.g. a proxy/load-balancer idle timeout with no terminal chunk)
  // must be reported as truncated, not indistinguishable from a natural
  // stop just because no error was thrown.
  it("reports truncated:true when the stream ends with no finish_reason at all", async () => {
    const chunks = [
      JSON.stringify({ choices: [{ delta: { content: "This looks done" } }] }),
    ];
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response(sseBody(chunks), { status: 200 }));
    const service = new OpenAiAdvisorService("test-key");

    const result = await service.chat(CONTEXT, [], jest.fn());

    expect(result).toEqual({ truncated: true });
  });

  // EPIC-023 Task G retry (HIGH five-reviewer finding, round 2) — a timeout
  // firing mid-stream (after headers/first chunk arrive) must classify as
  // ExternalRequestTimeoutError, matching claude-advisor.service.ts's
  // whole-loop try/catch, instead of surfacing as an unclassified error.
  it("classifies a timeout that fires mid-stream as ExternalRequestTimeoutError", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(abortingMidStreamBody(), { status: 200 }),
      );
    const service = new OpenAiAdvisorService("test-key");

    await expect(service.chat(CONTEXT, [], jest.fn())).rejects.toThrow(
      ExternalRequestTimeoutError,
    );
  });

  it("skips a malformed chunk instead of crashing the stream", async () => {
    const chunks = [
      "not json at all",
      JSON.stringify({ choices: [{ delta: { content: "ok" } }] }),
      "[DONE]",
    ];
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response(sseBody(chunks), { status: 200 }));
    const service = new OpenAiAdvisorService("test-key");
    const onToken = jest.fn();

    await service.chat(CONTEXT, [], onToken);

    expect(onToken).toHaveBeenCalledWith("ok");
  });

  it("maps a 401 response to AiAdvisorAuthError", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response("unauthorized", { status: 401 }));
    const service = new OpenAiAdvisorService("bad-key");

    await expect(service.chat(CONTEXT, [], jest.fn())).rejects.toThrow(
      AiAdvisorAuthError,
    );
  });

  it("maps a 429 response to AiAdvisorRateLimitError", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response("rate limited", { status: 429 }));
    const service = new OpenAiAdvisorService("test-key");

    await expect(service.chat(CONTEXT, [], jest.fn())).rejects.toThrow(
      AiAdvisorRateLimitError,
    );
  });

  it("surfaces a timeout as ExternalRequestTimeoutError", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    const service = new OpenAiAdvisorService("test-key");

    await expect(service.chat(CONTEXT, [], jest.fn())).rejects.toThrow(
      ExternalRequestTimeoutError,
    );
  });
});
