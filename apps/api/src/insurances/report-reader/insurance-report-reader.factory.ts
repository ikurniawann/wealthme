import Anthropic from "@anthropic-ai/sdk";
import { Injectable } from "@nestjs/common";
import { type AiProvider } from "@prisma/client";

import {
  AiAdvisorAuthError,
  AiAdvisorRateLimitError,
} from "../../ai-advisor/ai-advisor-provider.error";
import { parseGeminiRateLimit } from "../../ai-advisor/gemini-advisor.service";
import {
  ExternalRequestTimeoutError,
  fetchWithTimeout,
  isAbortTimeoutError,
} from "../../common/utils/external-fetch.util";
import { STATEMENT_READER_TIMEOUT_MS } from "../../reconciliation/statement-reader/claude-statement-reader.adapter";

import {
  INSURANCE_REPORT_SYSTEM_PROMPT,
  InsuranceReportParseError,
  buildInsuranceReportUserMessage,
  parseInsuranceReportResponseText,
} from "./insurance-report-prompt.util";

import type {
  InsuranceReportReaderPort,
  InsuranceReportReading,
  ReportPageText,
} from "./insurance-report-reader.port";

const DEFAULT_MODEL: Record<AiProvider, string> = {
  claude: "claude-haiku-4-5-20251001",
  openai: "gpt-4o-mini",
  gemini:
    process.env.GEMINI_STATEMENT_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    "gemini-2.5-flash",
};
const MAX_OUTPUT_TOKENS = 8192;

/** Sends one system + user turn and returns the raw text answer. */
type CompleteText = (system: string, user: string) => Promise<string>;

/**
 * Asuransi S8 — builds the report reader PER REQUEST from the family's own
 * decrypted key, like StatementReaderFactory. No DI-bound key, no mock: a
 * process-wide key would bill one family's read to another, and a mock
 * would answer with invented policy values.
 */
@Injectable()
export class InsuranceReportReaderFactory {
  create(
    provider: AiProvider,
    apiKey: string,
    model?: string | null,
  ): InsuranceReportReaderPort {
    const chosen = model?.trim() || DEFAULT_MODEL[provider];
    const complete = completerFor(provider, apiKey, chosen);
    return {
      async readReport(
        pages: ReportPageText[],
      ): Promise<InsuranceReportReading> {
        const text = await complete(
          INSURANCE_REPORT_SYSTEM_PROMPT,
          buildInsuranceReportUserMessage(pages),
        );
        return parseInsuranceReportResponseText(text);
      },
    };
  }
}

function completerFor(
  provider: AiProvider,
  apiKey: string,
  model: string,
): CompleteText {
  switch (provider) {
    case "claude":
      return claudeCompleter(apiKey, model);
    case "openai":
      return openAiCompleter(apiKey, model);
    case "gemini":
      return geminiCompleter(apiKey, model);
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unknown AI provider: ${String(_exhaustive)}`);
    }
  }
}

function claudeCompleter(apiKey: string, model: string): CompleteText {
  const client = new Anthropic({
    apiKey,
    timeout: STATEMENT_READER_TIMEOUT_MS,
  });
  return async (system, user) => {
    let message: Anthropic.Message;
    try {
      message = await client.messages.create({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system,
        messages: [{ role: "user", content: user }],
      });
    } catch (err: unknown) {
      if (err instanceof Anthropic.APIConnectionTimeoutError) {
        throw new ExternalRequestTimeoutError("Claude insurance report");
      }
      if (err instanceof Anthropic.AuthenticationError) {
        throw new AiAdvisorAuthError("Claude");
      }
      if (err instanceof Anthropic.RateLimitError) {
        throw new AiAdvisorRateLimitError("Claude");
      }
      throw err;
    }
    const first = message.content[0];
    return first?.type === "text" ? first.text : "";
  };
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  label: string,
): Promise<Response> {
  try {
    return await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      },
      STATEMENT_READER_TIMEOUT_MS,
      label,
    );
  } catch (err: unknown) {
    if (isAbortTimeoutError(err)) throw new ExternalRequestTimeoutError(label);
    throw err;
  }
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    throw new InsuranceReportParseError("upstream body was not JSON");
  }
}

function openAiCompleter(apiKey: string, model: string): CompleteText {
  return async (system, user) => {
    const res = await postJson(
      "https://api.openai.com/v1/chat/completions",
      { Authorization: `Bearer ${apiKey}` },
      {
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      },
      "OpenAI insurance report",
    );
    if (!res.ok) {
      // The body may quote the request (the policy document): never surfaced.
      await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403) {
        throw new AiAdvisorAuthError("OpenAI");
      }
      if (res.status === 429) throw new AiAdvisorRateLimitError("OpenAI");
      throw new Error(`OpenAI insurance report failed (${res.status})`);
    }
    const payload = (await readJson(res)) as {
      choices?: { message?: { content?: string | null } }[];
    };
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content) {
      throw new InsuranceReportParseError("empty completion");
    }
    return content;
  };
}

function geminiCompleter(apiKey: string, model: string): CompleteText {
  return async (system, user) => {
    const res = await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      // Header, not query string, so the key never lands in proxy logs.
      { "x-goog-api-key": apiKey },
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          // Transcription needs no reasoning; see the statement reader.
          ...(/^gemini-2\.5-flash/.test(model)
            ? { thinkingConfig: { thinkingBudget: 0 } }
            : {}),
          responseMimeType: "application/json",
          temperature: 0,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
      },
      "Gemini insurance report",
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403) {
        throw new AiAdvisorAuthError("Gemini");
      }
      if (res.status === 429) throw parseGeminiRateLimit(body);
      throw new Error(`Gemini insurance report failed (${res.status})`);
    }
    const payload = (await readJson(res)) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string" || !text) {
      throw new InsuranceReportParseError("empty completion");
    }
    return text;
  };
}
