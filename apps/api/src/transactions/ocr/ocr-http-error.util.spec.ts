import { type HttpException, HttpStatus } from "@nestjs/common";

import {
  AiAdvisorAuthError,
  AiAdvisorRateLimitError,
} from "../../ai-advisor/ai-advisor-provider.error";
import { AiKeyCorruptedError } from "../../ai-advisor/ai-key-corrupted.error";
import { ExternalRequestTimeoutError } from "../../common/utils/external-fetch.util";

import { toScanHttpException } from "./ocr-http-error.util";
import { OcrNotConfiguredError } from "./ocr-not-configured.error";
import { OcrParseError } from "./ocr-parse.error";

function bodyOf(err: HttpException): Record<string, unknown> {
  return err.getResponse() as Record<string, unknown>;
}

describe("toScanHttpException (EPIC-027 B8)", () => {
  it("maps a missing key to 412 OCR_NOT_CONFIGURED", () => {
    const exception = toScanHttpException(new OcrNotConfiguredError());
    expect(exception.getStatus()).toBe(HttpStatus.PRECONDITION_FAILED);
    expect(bodyOf(exception).code).toBe("OCR_NOT_CONFIGURED");
  });

  it("maps an undecryptable key to 409 AI_KEY_CORRUPTED", () => {
    const exception = toScanHttpException(new AiKeyCorruptedError());
    expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(bodyOf(exception).code).toBe("AI_KEY_CORRUPTED");
  });

  it("maps a provider auth failure to 502 OCR_AUTH without naming the key", () => {
    const exception = toScanHttpException(new AiAdvisorAuthError("OpenAI"));
    expect(exception.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    expect(bodyOf(exception).code).toBe("OCR_AUTH");
    expect(String(bodyOf(exception).message)).not.toContain("sk-");
  });

  it("maps a rate limit to 429 OCR_RATE_LIMITED and carries the scope", () => {
    const exception = toScanHttpException(
      new AiAdvisorRateLimitError("Gemini", "daily", undefined, "quota detail"),
    );
    expect(exception.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(bodyOf(exception).code).toBe("OCR_RATE_LIMITED");
    expect(bodyOf(exception).scope).toBe("daily");
    expect(String(bodyOf(exception).message)).not.toContain("quota detail");
  });

  it("maps a timeout to 504 OCR_TIMEOUT", () => {
    const exception = toScanHttpException(
      new ExternalRequestTimeoutError("Claude OCR request"),
    );
    expect(exception.getStatus()).toBe(HttpStatus.GATEWAY_TIMEOUT);
    expect(bodyOf(exception).code).toBe("OCR_TIMEOUT");
  });

  it("maps an unreadable response to 502 OCR_PARSE_FAILED", () => {
    const exception = toScanHttpException(new OcrParseError("malformed JSON"));
    expect(exception.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    expect(bodyOf(exception).code).toBe("OCR_PARSE_FAILED");
  });

  it("maps anything else to 502 OCR_UPSTREAM_FAILED without leaking the raw error", () => {
    const exception = toScanHttpException(
      new Error('OpenAI OCR request failed (500): {"key":"sk-secret"}'),
    );
    expect(exception.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    expect(bodyOf(exception).code).toBe("OCR_UPSTREAM_FAILED");
    expect(String(bodyOf(exception).message)).not.toContain("sk-secret");
  });
});
