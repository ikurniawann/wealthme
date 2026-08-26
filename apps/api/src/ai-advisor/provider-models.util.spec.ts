import {
  PROVIDER_DEFAULT_MODEL,
  listProviderModels,
} from "./provider-models.util";

/**
 * The model list is ASKED FOR, not hardcoded — that is the whole point of the
 * feature. A baked-in list is wrong the moment a provider ships or retires
 * something, and this project has already paid for that: `gemini-2.0-flash`
 * began answering every request with "no longer available", which surfaced as
 * a chat that never started even with a valid key.
 *
 * So these specs pin the parts that would silently offer the user a choice
 * that cannot work.
 */

function jsonResponse(payload: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as unknown as Response;
}

describe("listProviderModels", () => {
  afterEach(() => jest.restoreAllMocks());

  it("Gemini — keeps only models that can actually run generateContent", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({
        models: [
          {
            name: "models/gemini-2.5-flash",
            supportedGenerationMethods: ["generateContent"],
          },
          {
            name: "models/gemini-2.5-flash-lite",
            supportedGenerationMethods: ["generateContent"],
          },
          // Real entries from Google's catalogue that CANNOT do the work:
          // offering them is offering a choice that can only fail.
          {
            name: "models/text-embedding-004",
            supportedGenerationMethods: ["embedContent"],
          },
          {
            name: "models/aqa",
            supportedGenerationMethods: ["generateAnswer"],
          },
        ],
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const models = await listProviderModels("gemini", "k");

    const ids = models.map((m) => m.id);
    expect(ids).toContain("gemini-2.5-flash");
    expect(ids).toContain("gemini-2.5-flash-lite");
    expect(ids).not.toContain("text-embedding-004");
    expect(ids).not.toContain("aqa");
    // The key rides in the header, never the query string, so it cannot land
    // in a proxy or access log.
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain("k");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe(
      "k",
    );
  });

  it("marks the WealthMe default so the UI can say what is running", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        models: [
          {
            name: "models/gemini-2.5-flash",
            supportedGenerationMethods: ["generateContent"],
          },
        ],
      }),
    ) as unknown as typeof fetch;

    const models = await listProviderModels("gemini", "k");

    const fallback = models.find((m) => m.isDefault);
    expect(fallback?.id).toBe(PROVIDER_DEFAULT_MODEL.gemini);
  });

  it("always offers the default, even when the catalogue omits it", async () => {
    // A key without access to it, or a rename upstream. Without this the
    // picker could not express "leave it as it was".
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        models: [
          {
            name: "models/gemini-9.9-experimental",
            supportedGenerationMethods: ["generateContent"],
          },
        ],
      }),
    ) as unknown as typeof fetch;

    const models = await listProviderModels("gemini", "k");

    expect(models.map((m) => m.id)).toContain(PROVIDER_DEFAULT_MODEL.gemini);
  });

  it("OpenAI — drops models that cannot do the work, keeps the chat ones", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        data: [
          { id: "gpt-4o-mini" },
          { id: "gpt-4.1" },
          { id: "text-embedding-3-small" },
          { id: "dall-e-3" },
          { id: "whisper-1" },
        ],
      }),
    ) as unknown as typeof fetch;

    const ids = (await listProviderModels("openai", "k")).map((m) => m.id);

    expect(ids).toEqual(expect.arrayContaining(["gpt-4o-mini", "gpt-4.1"]));
    expect(ids).not.toContain("text-embedding-3-small");
    expect(ids).not.toContain("dall-e-3");
    expect(ids).not.toContain("whisper-1");
  });

  it("Claude — sends the version header the API requires", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse({ data: [{ id: "claude-sonnet-4-6" }] }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const ids = (await listProviderModels("claude", "k")).map((m) => m.id);

    expect(ids).toContain("claude-sonnet-4-6");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    // Anthropic rejects a request without it, so a missing header would make
    // the picker permanently empty for every Claude family.
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(headers["x-api-key"]).toBe("k");
  });

  it("reports a rejected key as an AUTH problem, not an empty list", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ error: {} }, 401),
      ) as unknown as typeof fetch;

    // An empty dropdown would read as "this provider has no models", sending
    // the user to look for the wrong problem.
    await expect(listProviderModels("gemini", "bad")).rejects.toThrow();
  });
});
