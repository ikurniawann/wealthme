import { z } from "zod";

import { AiAdvisorAuthError } from "../../ai-advisor/ai-advisor-provider.error";
import { parseGeminiRateLimit } from "../../ai-advisor/gemini-advisor.service";
import {
  ExternalRequestTimeoutError,
  fetchWithTimeout,
  isAbortTimeoutError,
} from "../../common/utils/external-fetch.util";

import { OcrParseError } from "./ocr-parse.error";
import { OCR_EXTRACTION_PROMPT, parseOcrResponseText } from "./ocr-prompt.util";

import type { OcrPort, OcrResult } from "./ocr.port";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
// Same override reasoning as GeminiAdvisorService: Google retires model ids,
// and the newest model carries the tightest free quota.
const GEMINI_OCR_MODEL =
  process.env.GEMINI_OCR_MODEL?.trim() ||
  process.env.GEMINI_MODEL?.trim() ||
  "gemini-2.5-flash";
const GEMINI_OCR_TIMEOUT_MS = 45_000;

const geminiResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({
            parts: z
              .array(z.object({ text: z.string().optional() }))
              .optional(),
          })
          .optional(),
      }),
    )
    .optional(),
});

/**
 * EPIC-027 D12 — Gemini vision adapter. Non-streaming `generateContent`
 * with an `inline_data` image part; the API key travels in the
 * `x-goog-api-key` header rather than the query string so it cannot land in
 * proxy/access logs (same reasoning as GeminiAdvisorService).
 */
/**
 * NOT `@Injectable()`, deliberately. This is built by hand, per request, from
 * the family's own decrypted key — it is never registered as a provider and
 * Nest could not construct it anyway (its constructor takes a runtime string).
 * Carrying the decorator claimed the opposite, and made `di-paramtypes.spec.ts`
 * police a class the container never touches.
 */
export class GeminiVisionOcrAdapter implements OcrPort {
  /** The family's chosen model, or the WealthMe default when unset. */
  private readonly model: string;

  constructor(
    private readonly apiKey: string,
    chosenModel?: string | null,
  ) {
    this.model = chosenModel?.trim() || GEMINI_OCR_MODEL;
  }

  async extractTransaction(imageBase64: string): Promise<OcrResult> {
    const url = `${GEMINI_API_BASE}/models/${this.model}:generateContent`;

    let res: Response;
    try {
      res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    inline_data: {
                      mime_type: "image/jpeg",
                      data: imageBase64,
                    },
                  },
                  { text: OCR_EXTRACTION_PROMPT },
                ],
              },
            ],
          }),
        },
        GEMINI_OCR_TIMEOUT_MS,
        "Gemini OCR request",
      );
    } catch (err: unknown) {
      if (isAbortTimeoutError(err)) {
        throw new ExternalRequestTimeoutError("Gemini OCR request");
      }
      throw err;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403) {
        throw new AiAdvisorAuthError("Gemini");
      }
      if (res.status === 429) {
        // Google states WHICH quota ran out in the body — reuse the advisor's
        // parser so a per-day cap is not reported as "try again shortly".
        throw parseGeminiRateLimit(body);
      }
      throw new Error(
        `Gemini OCR request failed (${res.status}): ${body.slice(0, 200)}`,
      );
    }

    let payload: unknown;
    try {
      payload = await res.json();
    } catch {
      throw new OcrParseError("upstream body was not JSON");
    }

    const parsed = geminiResponseSchema.safeParse(payload);
    const text = parsed.success
      ? parsed.data.candidates?.[0]?.content?.parts?.[0]?.text
      : undefined;
    if (!text) throw new OcrParseError("empty completion");

    return parseOcrResponseText(text);
  }
}
