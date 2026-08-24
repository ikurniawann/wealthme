import { HttpException, HttpStatus, type Logger } from "@nestjs/common";

import {
  AiAdvisorAuthError,
  AiAdvisorRateLimitError,
} from "../../ai-advisor/ai-advisor-provider.error";
import { AiKeyCorruptedError } from "../../ai-advisor/ai-key-corrupted.error";
import { ExternalRequestTimeoutError } from "../../common/utils/external-fetch.util";

import { OcrNotConfiguredError } from "./ocr-not-configured.error";
import { OcrParseError } from "./ocr-parse.error";

/**
 * EPIC-027 B8 — the scan endpoint answers JSON, not SSE, so the advisor's
 * SSE `code` mapping is reproduced here as real HTTP responses. Every
 * failure gets a stable `code` the web app can branch on, and a
 * user-facing Indonesian `message`.
 *
 * Nothing provider-supplied reaches the client: upstream bodies and the
 * decrypted key never appear in a message. The provider's own English
 * detail is logged server-side only.
 */
export function toScanHttpException(
  err: unknown,
  logger?: Logger,
): HttpException {
  if (err instanceof OcrNotConfiguredError) {
    return build(
      HttpStatus.PRECONDITION_FAILED,
      "OCR_NOT_CONFIGURED",
      err.message,
    );
  }
  if (err instanceof AiKeyCorruptedError) {
    return build(HttpStatus.CONFLICT, "AI_KEY_CORRUPTED", err.message);
  }
  if (err instanceof AiAdvisorAuthError) {
    return build(
      HttpStatus.BAD_GATEWAY,
      "OCR_AUTH",
      "Penyedia AI menolak API key keluarga ini — periksa kembali key di Pengaturan.",
    );
  }
  if (err instanceof AiAdvisorRateLimitError) {
    if (err.providerDetail) {
      logger?.warn(`OCR provider rate limit: ${err.providerDetail}`);
    }
    return build(
      HttpStatus.TOO_MANY_REQUESTS,
      "OCR_RATE_LIMITED",
      err.scope === "daily"
        ? "Kuota harian penyedia AI sudah habis — scan bisa dipakai lagi besok atau setelah kuota ditambah."
        : "Penyedia AI sedang membatasi permintaan — coba lagi sebentar lagi.",
      { scope: err.scope, retryAfterSeconds: err.retryAfterSeconds },
    );
  }
  if (err instanceof ExternalRequestTimeoutError) {
    return build(
      HttpStatus.GATEWAY_TIMEOUT,
      "OCR_TIMEOUT",
      "Scan struk terlalu lama diproses — coba lagi.",
    );
  }
  if (err instanceof OcrParseError) {
    logger?.warn(`OCR parse failure: ${err.message}`);
    return build(
      HttpStatus.BAD_GATEWAY,
      "OCR_PARSE_FAILED",
      "Struk tidak bisa dibaca — coba foto ulang dengan pencahayaan yang lebih baik.",
    );
  }

  logger?.error(
    `OCR scan failed: ${err instanceof Error ? err.message : String(err)}`,
  );
  return build(
    HttpStatus.BAD_GATEWAY,
    "OCR_UPSTREAM_FAILED",
    "Scan struk gagal — coba lagi sebentar lagi.",
  );
}

function build(
  status: HttpStatus,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
): HttpException {
  return new HttpException(
    { statusCode: status, code, message, ...extra },
    status,
  );
}
