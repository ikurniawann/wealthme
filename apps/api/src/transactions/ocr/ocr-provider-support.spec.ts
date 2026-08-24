import { supportsVisionOcr } from "./ocr-provider-support";

describe("supportsVisionOcr (EPIC-027 B5)", () => {
  it("reports every configurable provider as vision-capable", () => {
    expect(supportsVisionOcr("claude")).toBe(true);
    expect(supportsVisionOcr("openai")).toBe(true);
    expect(supportsVisionOcr("gemini")).toBe(true);
  });
});
