import Anthropic from "@anthropic-ai/sdk";

import {
  AiAdvisorAuthError,
  AiAdvisorRateLimitError,
} from "../../ai-advisor/ai-advisor-provider.error";
import { ExternalRequestTimeoutError } from "../../common/utils/external-fetch.util";

import { OCR_EXTRACTION_PROMPT, parseOcrResponseText } from "./ocr-prompt.util";

import type { OcrPort, OcrResult } from "./ocr.port";

const CLAUDE_OCR_MODEL = "claude-haiku-4-5-20251001" as const;
const MAX_TOKENS = 512;
// EPIC-027 D11 — a single JSON extraction, not a chat: bound it so a stalled
// upstream cannot hold the scan request (and its throttle slot) open.
const CLAUDE_OCR_TIMEOUT_MS = 45_000;

/**
 * EPIC-027 D11/D12 — Claude vision adapter, built PER REQUEST from the
 * family's own decrypted AI key by `OcrFactory` (never a boot-time DI
 * binding on a server env var). Shares `OCR_EXTRACTION_PROMPT` and
 * `ocrResultSchema` with the OpenAI and Gemini adapters.
 */
/**
 * NOT `@Injectable()`, deliberately. This is built by hand, per request, from
 * the family's own decrypted key — it is never registered as a provider and
 * Nest could not construct it anyway (its constructor takes a runtime string).
 * Carrying the decorator claimed the opposite, and made `di-paramtypes.spec.ts`
 * police a class the container never touches.
 */
export class ClaudeVisionOcrAdapter implements OcrPort {
  private readonly client: Anthropic;

  /** The family's chosen model, or the WealthMe default when unset. */
  private readonly model: string;

  constructor(apiKey: string, chosenModel?: string | null) {
    this.model = chosenModel?.trim() || CLAUDE_OCR_MODEL;
    this.client = new Anthropic({ apiKey, timeout: CLAUDE_OCR_TIMEOUT_MS });
  }

  async extractTransaction(imageBase64: string): Promise<OcrResult> {
    let message: Anthropic.Message;
    try {
      message = await this.client.messages.create({
        model: this.model,
        max_tokens: MAX_TOKENS,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: imageBase64,
                },
              },
              { type: "text", text: OCR_EXTRACTION_PROMPT },
            ],
          },
        ],
      });
    } catch (err: unknown) {
      // EPIC-027 B8 — typed failures, mirroring ClaudeAdvisorService, so the
      // controller can tell "your key was rejected" from "rate limited" from
      // "took too long". The SDK's own error text (which can quote request
      // bodies) never becomes the client-facing message.
      if (err instanceof Anthropic.APIConnectionTimeoutError) {
        throw new ExternalRequestTimeoutError("Claude OCR request");
      }
      if (err instanceof Anthropic.AuthenticationError) {
        throw new AiAdvisorAuthError("Claude");
      }
      if (err instanceof Anthropic.RateLimitError) {
        throw new AiAdvisorRateLimitError("Claude");
      }
      throw err;
    }

    const text =
      message.content[0]?.type === "text" ? message.content[0].text : "";
    return parseOcrResponseText(text);
  }
}
