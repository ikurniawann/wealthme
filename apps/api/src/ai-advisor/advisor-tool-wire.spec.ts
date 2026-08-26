/**
 * The tool loop, at the wire.
 *
 * The advisor only ever received the CURRENT month, so "berapa pengeluaran
 * bulan Maret" was unanswerable — and the model filled the gap by explaining
 * rather than admitting. Widening the prompt to every month would charge
 * every message for history most messages never use, against a free-tier key
 * that already runs out. So the model fetches instead.
 *
 * What is asserted here is the part that silently rots: that each provider is
 * actually SENT the tool, that the result is fed back in the shape that
 * provider expects, and that the answering turn offers no tools (a tool call
 * mid-stream could not be serviced).
 */

import { ADVISOR_TOOL_NAME } from "./advisor-tools";
import { GeminiAdvisorService } from "./gemini-advisor.service";
import { OpenAiAdvisorService } from "./openai-advisor.service";

import type { AdvisorContext } from "./ai-advisor.port";

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
} as unknown as AdvisorContext;

const MESSAGES = [{ role: "user" as const, content: "Pengeluaran Maret?" }];

function sseResponse(lines: string[]) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const l of lines) controller.enqueue(new TextEncoder().encode(l));
      controller.close();
    },
  });
  return { ok: true, status: 200, body } as unknown as Response;
}

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as unknown as Response;
}

function bodiesOf(fetchMock: jest.Mock): Record<string, unknown>[] {
  return fetchMock.mock.calls.map(
    ([, init]) =>
      JSON.parse((init as RequestInit).body as string) as Record<
        string,
        unknown
      >,
  );
}

describe("Gemini — tool rounds then a streamed answer", () => {
  it("declares the tool, feeds the result back, and drops tools to answer", async () => {
    const runTool = jest
      .fn()
      .mockResolvedValue('{"months":[{"month":"2026-03","expense":"300"}]}');
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      name: ADVISOR_TOOL_NAME,
                      args: { from: "2026-03-01", to: "2026-03-31" },
                    },
                  },
                ],
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ candidates: [{ content: { parts: [{ text: "" }] } }] }),
      )
      .mockResolvedValueOnce(
        sseResponse([
          'data: {"candidates":[{"content":{"parts":[{"text":"Maret 300"}]},"finishReason":"STOP"}]}\n\n',
        ]),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    const tokens: string[] = [];
    await new GeminiAdvisorService("k").chat(
      CONTEXT,
      MESSAGES,
      (t) => tokens.push(t),
      runTool,
    );

    // The model asked for the period it needed — not the family, which it
    // cannot name.
    expect(runTool).toHaveBeenCalledWith(ADVISOR_TOOL_NAME, {
      from: "2026-03-01",
      to: "2026-03-31",
    });

    const bodies = bodiesOf(fetchMock);
    const first = bodies[0] as {
      tools: { functionDeclarations: { name: string }[] }[];
    };
    expect(first.tools[0].functionDeclarations[0].name).toBe(ADVISOR_TOOL_NAME);
    // The result went back as a functionResponse turn, which is the only
    // shape Gemini reads it from.
    const fed = JSON.stringify((bodies[1] as { contents: unknown }).contents);
    expect(fed).toContain("functionResponse");
    expect(fed).toContain("2026-03");
    // The answering turn offers no tools.
    expect(bodies[2].tools).toBeUndefined();
    expect(tokens.join("")).toBe("Maret 300");
  });

  it("skips the tool round entirely when no runner is supplied", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        sseResponse([
          'data: {"candidates":[{"content":{"parts":[{"text":"hai"}]},"finishReason":"STOP"}]}\n\n',
        ]),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    await new GeminiAdvisorService("k").chat(CONTEXT, MESSAGES, () => {});

    // Exactly the old behaviour: one streaming call, nothing extra spent.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("OpenAI — tool rounds then a streamed answer", () => {
  it("sends the tool result as a `tool` message tied to the call id", async () => {
    const runTool = jest.fn().mockResolvedValue('{"totals":{}}');
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  {
                    id: "call_1",
                    function: {
                      name: ADVISOR_TOOL_NAME,
                      arguments: '{"from":"2026-03-01"}',
                    },
                  },
                ],
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: {} }] }))
      .mockResolvedValueOnce(
        sseResponse([
          'data: {"choices":[{"delta":{"content":"ok"},"finish_reason":null}]}\n\n',
          'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
        ]),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    await new OpenAiAdvisorService("k").chat(
      CONTEXT,
      MESSAGES,
      () => {},
      runTool,
    );

    expect(runTool).toHaveBeenCalledWith(ADVISOR_TOOL_NAME, {
      from: "2026-03-01",
    });
    const bodies = bodiesOf(fetchMock);
    const first = bodies[0] as { tools: { function: { name: string } }[] };
    expect(first.tools[0].function.name).toBe(ADVISOR_TOOL_NAME);
    const second = bodies[1] as {
      messages: { role: string; tool_call_id?: string }[];
    };
    const toolMsg = second.messages.find((m) => m.role === "tool");
    // Without the id OpenAI cannot match the result to the call.
    expect(toolMsg?.tool_call_id).toBe("call_1");
    expect(bodies[2].tools).toBeUndefined();
  });

  it("does not fail the question when the model emits malformed arguments", async () => {
    const runTool = jest.fn().mockResolvedValue("{}");
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: "call_1",
                    function: {
                      name: ADVISOR_TOOL_NAME,
                      arguments: "{not json",
                    },
                  },
                ],
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: {} }] }))
      .mockResolvedValueOnce(
        sseResponse([
          'data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\n',
        ]),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    // A model mistake must not throw away the user's whole question.
    await expect(
      new OpenAiAdvisorService("k").chat(CONTEXT, MESSAGES, () => {}, runTool),
    ).resolves.toBeDefined();
    expect(runTool).toHaveBeenCalled();
  });
});
