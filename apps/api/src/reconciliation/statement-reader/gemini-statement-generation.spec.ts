/**
 * The Gemini statement request had no `generationConfig` at all, and it cost a
 * production failure:
 *
 *     statement page read FAILED: provider=gemini page=2/5 ms=55001
 *       err=ExternalRequestTimeoutError
 *
 * `gemini-2.5-flash` does DYNAMIC THINKING by default, so the model could
 * spend the whole 55s budget reasoning before emitting a single row — on ONE
 * page of ~2KB that should transcribe about ten rows. Transcription needs no
 * reasoning: every rule in the prompt is mechanical ("copy the amount
 * character-for-character").
 *
 * These specs pin the request shape, because the failure it prevents is
 * invisible from inside the process: the call simply takes too long, and
 * nothing about the code looks wrong.
 */

import { GeminiStatementReaderAdapter } from "./gemini-statement-reader.adapter";

const VALID_ANSWER = JSON.stringify({
  rows: [
    { date: "2026-07-01", description: "PEMBAYARAN QR", amount: "-37.000,00" },
  ],
  totals: {
    openingBalance: null,
    closingBalance: null,
    totalCredit: null,
    totalDebit: null,
  },
});

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as unknown as Response;
}

type GeminiBody = {
  generationConfig?: {
    thinkingConfig?: { thinkingBudget?: number };
    responseMimeType?: string;
    temperature?: number;
    maxOutputTokens?: number;
  };
};

async function captureRequest(): Promise<GeminiBody> {
  const fetchMock = jest.fn().mockResolvedValue(
    jsonResponse({
      candidates: [{ content: { parts: [{ text: VALID_ANSWER }] } }],
      usageMetadata: {
        promptTokenCount: 900,
        candidatesTokenCount: 120,
        thoughtsTokenCount: 0,
      },
    }),
  );
  global.fetch = fetchMock as unknown as typeof fetch;
  await new GeminiStatementReaderAdapter("k").readStatement("01 Jul | X | -1");
  return JSON.parse(
    (fetchMock.mock.calls[0]![1] as { body: string }).body,
  ) as GeminiBody;
}

describe("the family's chosen model reaches the provider", () => {
  it("uses the chosen model in the request URL, not the default", async () => {
    // Without this the picker in Pengaturan would appear to work while
    // changing nothing at all — the worst kind of setting.
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({
        candidates: [{ content: { parts: [{ text: VALID_ANSWER }] } }],
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await new GeminiStatementReaderAdapter(
      "k",
      "gemini-2.5-flash-lite",
    ).readStatement("01 Jul | X | -1");

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("gemini-2.5-flash-lite:generateContent");
    expect(url).not.toContain("/gemini-2.5-flash:generateContent");
  });

  it("falls back to the default when the family has chosen nothing", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({
        candidates: [{ content: { parts: [{ text: VALID_ANSWER }] } }],
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    // null is what the column holds for every family that predates the
    // picker; it must keep working exactly as before.
    await new GeminiStatementReaderAdapter("k", null).readStatement(
      "01 Jul | X | -1",
    );

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("gemini-2.5-flash:generateContent");
  });
});

describe("Gemini statement request — bounded generation", () => {
  const MODEL_ENV = process.env.GEMINI_STATEMENT_MODEL;

  afterEach(() => {
    if (MODEL_ENV === undefined) delete process.env.GEMINI_STATEMENT_MODEL;
    else process.env.GEMINI_STATEMENT_MODEL = MODEL_ENV;
    jest.resetModules();
  });

  it("disables thinking, so the budget is spent transcribing rather than reasoning", async () => {
    const body = await captureRequest();
    expect(body.generationConfig?.thinkingConfig?.thinkingBudget).toBe(0);
  });

  it("asks for JSON directly and pins the temperature", async () => {
    const body = await captureRequest();
    // The same page must read the same way twice; transcription is not a
    // creative task.
    expect(body.generationConfig?.responseMimeType).toBe("application/json");
    expect(body.generationConfig?.temperature).toBe(0);
  });

  it("caps the output, so a runaway generation cannot burn the budget and the quota", async () => {
    const body = await captureRequest();
    expect(body.generationConfig?.maxOutputTokens).toBeGreaterThan(0);
  });

  it("omits thinkingConfig for a model that would REJECT it", async () => {
    // Only the 2.5 Flash family can turn thinking off. 2.5 Pro answers
    // `thinkingBudget: 0` with a 400, so sending it unconditionally would
    // break every read for anyone overriding the model id.
    process.env.GEMINI_STATEMENT_MODEL = "gemini-2.5-pro";
    jest.resetModules();
    const { GeminiStatementReaderAdapter: Adapter } =
      (await import("./gemini-statement-reader.adapter")) as {
        GeminiStatementReaderAdapter: typeof GeminiStatementReaderAdapter;
      };

    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({
        candidates: [{ content: { parts: [{ text: VALID_ANSWER }] } }],
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    await new Adapter("k").readStatement("01 Jul | X | -1");

    const body = JSON.parse(
      (fetchMock.mock.calls[0]![1] as { body: string }).body,
    ) as GeminiBody;
    expect(body.generationConfig?.thinkingConfig).toBeUndefined();
    // The bounds that every model accepts are still applied.
    expect(body.generationConfig?.responseMimeType).toBe("application/json");
  });
});
