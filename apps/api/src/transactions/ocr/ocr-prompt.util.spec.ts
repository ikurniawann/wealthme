import { OcrParseError } from "./ocr-parse.error";
import { parseOcrResponseText } from "./ocr-prompt.util";

const VALID = JSON.stringify({
  amount: 45000,
  description: "Indomaret",
  occurredAt: "2026-02-01T10:00:00.000Z",
  categoryHint: "Belanja",
});

describe("parseOcrResponseText (EPIC-027 D12/B8)", () => {
  it("parses a bare JSON object", () => {
    expect(parseOcrResponseText(VALID)).toEqual({
      amount: 45000,
      description: "Indomaret",
      occurredAt: "2026-02-01T10:00:00.000Z",
      categoryHint: "Belanja",
    });
  });

  it("parses JSON wrapped in prose or a code fence", () => {
    const wrapped = "Here you go:\n```json\n" + VALID + "\n```";
    expect(parseOcrResponseText(wrapped).amount).toBe(45000);
  });

  it("rounds a fractional amount to whole rupiah", () => {
    const body = VALID.replace("45000", "45000.4");
    expect(parseOcrResponseText(body).amount).toBe(45000);
  });

  it("throws OcrParseError when the response carries no JSON object", () => {
    expect(() => parseOcrResponseText("I cannot read this receipt.")).toThrow(
      OcrParseError,
    );
  });

  it("throws OcrParseError on malformed JSON", () => {
    expect(() => parseOcrResponseText('{ "amount": 45000, ')).toThrow(
      OcrParseError,
    );
  });

  it("throws OcrParseError on a schema violation (negative amount)", () => {
    const body = VALID.replace("45000", "-1");
    expect(() => parseOcrResponseText(body)).toThrow(OcrParseError);
  });

  it("throws OcrParseError when a field has the wrong type", () => {
    const body = VALID.replace("45000", '"empat puluh lima ribu"');
    expect(() => parseOcrResponseText(body)).toThrow(OcrParseError);
  });

  it("never echoes the model's raw output in the error message", () => {
    const secretish = "sk-should-never-be-echoed";
    try {
      parseOcrResponseText(secretish);
      fail("expected OcrParseError");
    } catch (err) {
      expect((err as Error).message).not.toContain(secretish);
    }
  });
});
