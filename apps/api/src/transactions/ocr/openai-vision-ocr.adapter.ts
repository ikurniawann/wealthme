import { z } from "zod";

import {
  AiAdvisorAuthError,
  AiAdvisorRateLimitError,
} from "../../ai-advisor/ai-advisor-provider.error";
import {
  ExternalRequestTimeoutError,
  fetchWithTimeout,
  isAbortTimeoutError,
} from "../../common/utils/external-fetch.util";

import { OcrParseError } from "./ocr-parse.error";
import { OCR_EXTRACTION_PROMPT, parseOcrResponseText } from "./ocr-prompt.util";

import type { OcrPort, OcrResult } from "./ocr.port";

const OPENAI_CHAT_COMPLETIONS_URL =
  "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini" as const;
const MAX_TOKENS = 512;
const OPENAI_OCR_TIMEOUT_MS = 45_000;

// EPIC-027 B8 — validate the envelope at the boundary; the message content
// itself is then handed to the shared `parseOcrResponseText`.
const chatCompletionSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().nullable().optional() }),
      }),
    )
    .optional(),
});

/**
 * EPIC-027 D12 — OpenAI vision adapter. Non-streaming Chat Completions with
 * an `image_url` content part carrying a base64 data URL: this is a single
 * JSON extraction, so there is nothing to stream.
 */
/**
 * NOT `@Injectable()`, deliberately. This is built by hand, per request, from
 * the family's own decrypted key — it is never registered as a provider and
 * Nest could not construct it anyway (its constructor takes a runtime string).
 * Carrying the decorator claimed the opposite, and made `di-paramtypes.spec.ts`
 * police a class the container never touches.
 */
export class OpenAiVisionOcrAdapter implements OcrPort {
  /** The family's chosen model, or the WealthMe default when unset. */
  private readonly model: string;

  constructor(
    private readonly apiKey: string,
    chosenModel?: string | null,
  ) {
    this.model = chosenModel?.trim() || MODEL;
  }

  async extractTransaction(imageBase64: string): Promise<OcrResult> {
    let res: Response;
    try {
      res = await fetchWithTimeout(
        OPENAI_CHAT_COMPLETIONS_URL,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.model,
            max_tokens: MAX_TOKENS,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/jpeg;base64,${imageBase64}`,
                    },
                  },
                  { type: "text", text: OCR_EXTRACTION_PROMPT },
                ],
              },
            ],
          }),
        },
        OPENAI_OCR_TIMEOUT_MS,
        "OpenAI OCR request",
      );
    } catch (err: unknown) {
      if (isAbortTimeoutError(err)) {
        throw new ExternalRequestTimeoutError("OpenAI OCR request");
      }
      throw err;
    }

    if (!res.ok) {
      // The body is read but never surfaced to the client — it can quote the
      // request (and therefore the image) back at us.
      const body = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403) {
        throw new AiAdvisorAuthError("OpenAI");
      }
      if (res.status === 429) {
        throw new AiAdvisorRateLimitError("OpenAI");
      }
      throw new Error(
        `OpenAI OCR request failed (${res.status}): ${body.slice(0, 200)}`,
      );
    }

    let payload: unknown;
    try {
      payload = await res.json();
    } catch {
      throw new OcrParseError("upstream body was not JSON");
    }

    const parsed = chatCompletionSchema.safeParse(payload);
    const content = parsed.success
      ? parsed.data.choices?.[0]?.message.content
      : null;
    if (!content) throw new OcrParseError("empty completion");

    return parseOcrResponseText(content);
  }
}
