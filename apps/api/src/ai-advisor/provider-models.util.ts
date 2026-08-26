import { Logger } from "@nestjs/common";

import { fetchWithTimeout } from "../common/utils/external-fetch.util";

import { AiAdvisorAuthError } from "./ai-advisor-provider.error";

import type { AiProvider } from "@prisma/client";

/**
 * The model list is ASKED FOR, not hardcoded.
 *
 * A baked-in list is wrong the moment a provider ships or retires something,
 * and this codebase has already paid for that: `gemini-2.0-flash` began
 * answering every request with "This model is no longer available", which
 * surfaced as a chat that never started even with a valid key. A list that
 * ages is a list that lies, so each provider is asked what it currently
 * serves, using the family's OWN key — which also means the answer reflects
 * what that key is actually entitled to.
 *
 * All three expose a catalogue endpoint:
 *   Gemini  GET /v1beta/models          (x-goog-api-key)
 *   OpenAI  GET /v1/models              (Bearer)
 *   Claude  GET /v1/models              (x-api-key + anthropic-version)
 */

const LIST_TIMEOUT_MS = 15_000;

export type ProviderModel = {
  id: string;
  label: string;
  /** True for the model the code falls back to when nothing is chosen. */
  isDefault: boolean;
};

/**
 * What each provider gets when the family has chosen nothing. Kept in ONE
 * place so the picker can mark it, and so a future change to a default is a
 * single edit rather than a hunt through nine adapters.
 */
export const PROVIDER_DEFAULT_MODEL: Record<AiProvider, string> = {
  gemini: "gemini-2.5-flash",
  openai: "gpt-4o-mini",
  claude: "claude-haiku-4-5-20251001",
};

/**
 * Models that cannot do the work WealthMe asks of them are filtered out.
 *
 * Offering an embedding model in a dropdown that drives chat, receipt OCR and
 * statement transcription is offering a choice that can only fail — the user
 * would pick it, and every AI feature would break with a provider error that
 * says nothing about the real cause.
 */
function isUsable(id: string): boolean {
  const lower = id.toLowerCase();
  const unusable = [
    "embedding",
    "embed",
    "aqa", // Gemini's attributed-question-answering endpoint, not generateContent
    "imagen",
    "veo",
    "tts",
    "whisper",
    "dall-e",
    "moderation",
    "audio",
    "realtime",
    "transcribe",
    "davinci",
    "babbage",
    "computer-use",
  ];
  return !unusable.some((token) => lower.includes(token));
}

function toModel(id: string, provider: AiProvider): ProviderModel {
  return {
    id,
    label: id,
    isDefault: id === PROVIDER_DEFAULT_MODEL[provider],
  };
}

async function listGemini(apiKey: string): Promise<string[]> {
  const res = await fetchWithTimeout(
    "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200",
    { headers: { "x-goog-api-key": apiKey } },
    LIST_TIMEOUT_MS,
    "Gemini model list",
  );
  if (res.status === 401 || res.status === 403) {
    throw new AiAdvisorAuthError("Gemini");
  }
  if (!res.ok) throw new Error(`Gemini model list failed (${res.status})`);
  const body = (await res.json()) as {
    models?: { name?: string; supportedGenerationMethods?: string[] }[];
  };
  return (
    (body.models ?? [])
      // Only what `generateContent` can actually drive — the same call every
      // WealthMe feature makes.
      .filter((m) =>
        (m.supportedGenerationMethods ?? []).includes("generateContent"),
      )
      .map((m) => (m.name ?? "").replace(/^models\//, ""))
      .filter(Boolean)
  );
}

async function listOpenAi(apiKey: string): Promise<string[]> {
  const res = await fetchWithTimeout(
    "https://api.openai.com/v1/models",
    { headers: { Authorization: `Bearer ${apiKey}` } },
    LIST_TIMEOUT_MS,
    "OpenAI model list",
  );
  if (res.status === 401 || res.status === 403) {
    throw new AiAdvisorAuthError("OpenAI");
  }
  if (!res.ok) throw new Error(`OpenAI model list failed (${res.status})`);
  const body = (await res.json()) as { data?: { id?: string }[] };
  return (body.data ?? []).map((m) => m.id ?? "").filter(Boolean);
}

async function listClaude(apiKey: string): Promise<string[]> {
  const res = await fetchWithTimeout(
    "https://api.anthropic.com/v1/models?limit=100",
    {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    },
    LIST_TIMEOUT_MS,
    "Claude model list",
  );
  if (res.status === 401 || res.status === 403) {
    throw new AiAdvisorAuthError("Claude");
  }
  if (!res.ok) throw new Error(`Claude model list failed (${res.status})`);
  const body = (await res.json()) as { data?: { id?: string }[] };
  return (body.data ?? []).map((m) => m.id ?? "").filter(Boolean);
}

/**
 * Lists what this key can currently use, newest-looking first.
 *
 * The key is used and discarded: it is never returned, never logged, and no
 * part of it appears in an error raised from here.
 */
export async function listProviderModels(
  provider: AiProvider,
  apiKey: string,
): Promise<ProviderModel[]> {
  const logger = new Logger("ProviderModels");
  const ids =
    provider === "gemini"
      ? await listGemini(apiKey)
      : provider === "openai"
        ? await listOpenAi(apiKey)
        : await listClaude(apiKey);

  const usable = [...new Set(ids)].filter(isUsable).sort((a, b) =>
    // Descending, so the newest generation is at the top where people look —
    // `localeCompare` with `numeric` keeps 2.5 above 2.0 rather than sorting
    // them as plain strings.
    b.localeCompare(a, "en", { numeric: true }),
  );
  logger.log(`model list: provider=${provider} usable=${usable.length}`);

  const fallback = PROVIDER_DEFAULT_MODEL[provider];
  // The default must always be offerable, even if the catalogue does not name
  // it (a key without access to it, or a rename): otherwise the picker cannot
  // express "leave it as it was".
  if (!usable.includes(fallback)) usable.unshift(fallback);
  return usable.map((id) => toModel(id, provider));
}
