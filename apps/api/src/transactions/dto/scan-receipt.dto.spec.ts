import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";

import { ScanReceiptDto } from "./scan-receipt.dto";

function errorsFor(imageBase64: unknown): string[] {
  const dto = plainToInstance(ScanReceiptDto, { imageBase64 });
  return validateSync(dto).flatMap((e) => Object.keys(e.constraints ?? {}));
}

// 64 chars of standard base64 — the shape a stripped data URL produces.
const VALID = "a".repeat(60) + "bc==";

describe("ScanReceiptDto (EPIC-027 group 6 review, MEDIUM)", () => {
  it("accepts raw base64 with the data-URL prefix already stripped", () => {
    expect(errorsFor(VALID)).toEqual([]);
  });

  it("accepts unpadded and URL-safe base64", () => {
    expect(errorsFor("a".repeat(40) + "-_")).toEqual([]);
  });

  it("rejects an empty string instead of paying for an upstream call", () => {
    expect(errorsFor("")).not.toEqual([]);
  });

  it("rejects whitespace-only and line-wrapped payloads", () => {
    expect(errorsFor(" ".repeat(64))).not.toEqual([]);
    expect(errorsFor(VALID.slice(0, 32) + "\n" + VALID.slice(32))).toContain(
      "matches",
    );
  });

  it("rejects a payload that still carries the data-URL prefix", () => {
    expect(errorsFor(`data:image/jpeg;base64,${VALID}`)).toContain("matches");
  });

  it("rejects a non-string body", () => {
    expect(errorsFor(12345)).not.toEqual([]);
  });
});
