import { HttpException, HttpStatus, type Logger } from "@nestjs/common";

import {
  AiAdvisorAuthError,
  AiAdvisorRateLimitError,
} from "../../ai-advisor/ai-advisor-provider.error";
import { AiKeyCorruptedError } from "../../ai-advisor/ai-key-corrupted.error";
import { ExternalRequestTimeoutError } from "../../common/utils/external-fetch.util";

import { StatementReaderNotConfiguredError } from "./statement-reader-not-configured.error";
import { StatementReaderParseError } from "./statement-reader-parse.error";

/**
 * EPIC-029 E2d — the statement-read failure taxonomy, mirroring the OCR set
 * (`toScanHttpException`) one-for-one so the two paid-AI paths behave
 * identically. Every failure gets a stable `code` the web app branches on
 * and a user-facing Indonesian `message` that says what to do next.
 *
 * Nothing provider-supplied reaches the client: upstream bodies, the
 * decrypted key, and the statement text itself never appear in a message.
 * The provider's own English detail is logged server-side only.
 *
 * The page-cap and empty-text refusals are NOT here — they are raised
 * directly by the service as `UnprocessableEntityException`s with their own
 * codes, because they are decided before any provider is contacted and there
 * is no upstream error to map.
 */
export function toStatementReaderHttpException(
  err: unknown,
  logger?: Logger,
): HttpException {
  if (err instanceof HttpException) return err;

  if (err instanceof StatementReaderNotConfiguredError) {
    return build(
      HttpStatus.PRECONDITION_FAILED,
      "STATEMENT_AI_NOT_CONFIGURED",
      err.message,
    );
  }
  if (err instanceof AiKeyCorruptedError) {
    return build(HttpStatus.CONFLICT, "AI_KEY_CORRUPTED", err.message);
  }
  if (err instanceof AiAdvisorAuthError) {
    return build(
      HttpStatus.BAD_GATEWAY,
      "STATEMENT_AI_AUTH",
      "Penyedia AI menolak API key keluarga ini — periksa kembali key di Pengaturan.",
    );
  }
  if (err instanceof AiAdvisorRateLimitError) {
    if (err.providerDetail) {
      logger?.warn(`Statement reader rate limit: ${err.providerDetail}`);
    }
    return build(
      HttpStatus.TOO_MANY_REQUESTS,
      "STATEMENT_AI_RATE_LIMITED",
      err.scope === "daily"
        ? "Kuota harian penyedia AI sudah habis — statement bisa dibaca lagi besok atau setelah kuota ditambah."
        : "Penyedia AI sedang membatasi permintaan — coba lagi sebentar lagi.",
      { scope: err.scope, retryAfterSeconds: err.retryAfterSeconds },
    );
  }
  if (err instanceof ExternalRequestTimeoutError) {
    return build(
      HttpStatus.GATEWAY_TIMEOUT,
      "STATEMENT_AI_TIMEOUT",
      "Pembacaan statement terlalu lama diproses — coba lagi, atau unggah periode yang lebih pendek.",
    );
  }
  if (err instanceof StatementReaderParseError) {
    logger?.warn(`Statement reader parse failure: ${err.message}`);
    return build(
      HttpStatus.BAD_GATEWAY,
      "STATEMENT_AI_PARSE_FAILED",
      "Statement tidak bisa dibaca dengan rapi oleh AI — coba lagi, atau ekspor mutasi sebagai CSV/Excel dari aplikasi bank Anda.",
    );
  }

  logger?.error(
    `Statement read failed: ${err instanceof Error ? err.message : String(err)}`,
  );
  return build(
    HttpStatus.BAD_GATEWAY,
    "STATEMENT_AI_UPSTREAM_FAILED",
    "Pembacaan statement gagal — coba lagi sebentar lagi.",
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
