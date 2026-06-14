import Anthropic from "@anthropic-ai/sdk";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { OcrPort, OcrResult } from "./ocr.port";

const CLAUDE_OCR_MODEL = "claude-haiku-4-5-20251001" as const;

const ocrResultSchema = z.object({
  amount: z.number().finite(),
  description: z.string().max(500),
  occurredAt: z.string().datetime({ offset: true }).or(z.string().min(1)),
  categoryHint: z.string().max(100),
});

@Injectable()
export class ClaudeVisionOcrAdapter implements OcrPort {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async extractTransaction(imageBase64: string): Promise<OcrResult> {
    let message: Anthropic.Message;
    try {
      message = await this.client.messages.create({
        model: CLAUDE_OCR_MODEL,
        max_tokens: 512,
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
              {
                type: "text",
                text: `Extract transaction data from this receipt image. Return ONLY a JSON object with these fields:
{
  "amount": <number in IDR, integers only>,
  "description": "<merchant or store name>",
  "occurredAt": "<ISO 8601 datetime>",
  "categoryHint": "<Indonesian category: Makanan & Minuman | Belanja | Transportasi | Hiburan | Kesehatan | Pendidikan | Tagihan | Lainnya>"
}`,
              },
            ],
          },
        ],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`OCR upstream error: ${msg}`);
    }

    const text =
      message.content[0]?.type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`OCR parse failed: ${text}`);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error(`OCR JSON parse failed: ${text.slice(0, 200)}`);
    }

    const validated = ocrResultSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(
        `OCR response schema invalid: ${validated.error.message}`,
      );
    }

    return validated.data;
  }
}
