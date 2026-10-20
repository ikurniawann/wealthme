import { HttpException, HttpStatus, type Logger } from "@nestjs/common";

import {
  AiAdvisorAuthError,
  AiAdvisorRateLimitError,
} from "../../ai-advisor/ai-advisor-provider.error";
import { AiKeyCorruptedError } from "../../ai-advisor/ai-key-corrupted.error";
import { ExternalRequestTimeoutError } from "../../common/utils/external-fetch.util";

import {
  InsuranceReportNotConfiguredError,
  InsuranceReportParseError,
} from "./insurance-report-prompt.util";

import type { InsuranceReportErrorCode } from "@wealthme/contracts";

/**
 * Asuransi S8 — the report-read failure taxonomy, one-for-one with the
 * statement reader's (`toStatementReaderHttpException`), under INSURANCE_*
 * codes the web app branches on. Nothing provider-supplied, no key and no
 * document text ever reaches the client message.
 */
export function toInsuranceReportHttpException(
  err: unknown,
  logger?: Logger,
): HttpException {
  if (err instanceof HttpException) return err;
  if (err instanceof InsuranceReportNotConfiguredError) {
    return build(
      HttpStatus.PRECONDITION_FAILED,
      "INSURANCE_AI_NOT_CONFIGURED",
      err.message,
    );
  }
  if (err instanceof AiKeyCorruptedError) {
    return build(HttpStatus.CONFLICT, "AI_KEY_CORRUPTED", err.message);
  }
  if (err instanceof AiAdvisorAuthError) {
    return build(
      HttpStatus.BAD_GATEWAY,
      "INSURANCE_AI_AUTH",
      "Penyedia AI menolak API key keluarga ini — periksa kembali key di Pengaturan.",
    );
  }
  if (err instanceof AiAdvisorRateLimitError) {
    return build(
      HttpStatus.TOO_MANY_REQUESTS,
      "INSURANCE_AI_RATE_LIMITED",
      err.scope === "daily"
        ? "Kuota harian penyedia AI sudah habis — coba lagi besok, atau isi data polis secara manual."
        : "Penyedia AI sedang membatasi permintaan — coba lagi sebentar lagi.",
      { scope: err.scope, retryAfterSeconds: err.retryAfterSeconds },
    );
  }
  if (err instanceof ExternalRequestTimeoutError) {
    return build(
      HttpStatus.GATEWAY_TIMEOUT,
      "INSURANCE_AI_TIMEOUT",
      "Pembacaan laporan terlalu lama — coba lagi, atau unggah halaman yang memuat nilai polis saja.",
    );
  }
  if (err instanceof InsuranceReportParseError) {
    logger?.warn(`Insurance report parse failure: ${err.message}`);
    return build(
      HttpStatus.BAD_GATEWAY,
      "INSURANCE_AI_PARSE_FAILED",
      "Laporan tidak bisa dibaca dengan rapi oleh AI — coba lagi, atau isi nilai polis secara manual.",
    );
  }
  logger?.error(
    `Insurance report read failed: ${err instanceof Error ? err.name : typeof err}`,
  );
  return build(
    HttpStatus.BAD_GATEWAY,
    "INSURANCE_AI_UPSTREAM_FAILED",
    "Pembacaan laporan gagal — coba lagi sebentar lagi.",
  );
}

export function build(
  status: HttpStatus,
  code: InsuranceReportErrorCode,
  message: string,
  extra?: Record<string, unknown>,
): HttpException {
  return new HttpException(
    { statusCode: status, code, message, ...extra },
    status,
  );
}
