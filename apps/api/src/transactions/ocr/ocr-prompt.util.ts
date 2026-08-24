import { OcrParseError } from "./ocr-parse.error";
import { ocrResultSchema, type OcrResult } from "./ocr.port";

/**
 * EPIC-027 D12 — the SINGLE prompt every vision adapter sends. The three
 * providers must ask the same question in the same words, or the same
 * receipt yields a different transaction depending on which key the family
 * happens to have configured.
 */
export const OCR_EXTRACTION_PROMPT = `Extract transaction data from this receipt image. Return ONLY a JSON object with these fields:
{
  "amount": <number in IDR, integers only>,
  "description": "<merchant or store name>",
  "occurredAt": "<ISO 8601 datetime>",
  "categoryHint": "<Indonesian category: Makanan & Minuman | Belanja | Transportasi | Hiburan | Kesehatan | Pendidikan | Tagihan | Lainnya>"
}`;

/**
 * Turns a provider's raw text answer into a validated `OcrResult`.
 *
 * Models routinely wrap the JSON in prose or a ``` fence, so the first
 * balanced-looking object is extracted before parsing. Every failure path
 * raises `OcrParseError` — never a bare `Error` carrying the model's own
 * output, which is echoed to the client.
 */
export function parseOcrResponseText(text: string): OcrResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new OcrParseError("no JSON object in response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new OcrParseError("malformed JSON");
  }

  const validated = ocrResultSchema.safeParse(parsed);
  if (!validated.success) {
    const fields = validated.error.issues
      .map((issue) => issue.path.join(".") || "(root)")
      .join(", ");
    throw new OcrParseError(`invalid fields: ${fields}`);
  }

  return validated.data;
}
