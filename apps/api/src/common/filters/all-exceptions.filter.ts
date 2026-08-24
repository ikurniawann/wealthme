import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";

import type { Request, Response } from "express";

/**
 * `HttpException.message` is a static string (e.g. "Bad Request Exception")
 * for exceptions built by Nest's `ValidationPipe` — the real per-field
 * reasons live in `getResponse().message`. Prefer that structured body so
 * clients see the actual validation failure instead of a generic label.
 */
function extractMessage(exception: HttpException): string | string[] {
  const body = exception.getResponse();
  if (typeof body === "string") return body;
  if (body && typeof body === "object" && "message" in body) {
    return (body as { message: string | string[] }).message;
  }
  return exception.message;
}

/**
 * EPIC-023 Task G retry (HIGH five-reviewer finding, round 2) — services
 * like `ReconciliationService` attach a stable `code` (via a local
 * `withCode()` helper) alongside the human-readable message on their
 * thrown `HttpException`s, specifically so the web app can render its own
 * localized copy instead of the raw (Indonesian) message. This filter used
 * to build the response body from scratch and never read `code` off the
 * exception at all — the field never reached the wire, so every
 * locale-aware error path silently fell back to the raw message regardless
 * of locale. Only forwarded for a genuine `HttpException` below 500: a
 * 5xx or non-`HttpException` body must stay generic and never leak
 * internals, `code` included.
 */
function extractCode(exception: HttpException): string | undefined {
  const body = exception.getResponse();
  if (body && typeof body === "object" && "code" in body) {
    const code = (body as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

/**
 * Stable `code` for a body that exceeded the transport limit. Mirrored in
 * `apps/web/src/hooks/receipt-scan.ts` so the client can say "the image is
 * too large" instead of a generic failure — rename on one side only and the
 * web falls back to the generic branch.
 */
export const PAYLOAD_TOO_LARGE_CODE = "PAYLOAD_TOO_LARGE";

/**
 * Body-parser rejects an oversized body with a `PayloadTooLargeError`: a
 * plain `Error`, NOT an `HttpException`, carrying `status`/`statusCode` 413
 * and `type: "entity.too.large"`. This filter only reads `getStatus()` off a
 * real `HttpException`, so every one of those used to be reported as a
 * generic 500 — the client showed "something went wrong" for what is really
 * "your file is too big, send a smaller one".
 *
 * Normalized into a genuine 413 `HttpException` here, with a `code` the web
 * app can branch on, following the same convention `toScanHttpException`
 * already uses. The message is written for a user: no path, no parser
 * internals, no byte counts of our own configuration.
 */
function asPayloadTooLarge(exception: unknown): HttpException | undefined {
  if (exception instanceof HttpException) return undefined;
  if (!exception || typeof exception !== "object") return undefined;

  const candidate = exception as {
    type?: unknown;
    status?: unknown;
    statusCode?: unknown;
  };
  const isTooLarge =
    candidate.type === "entity.too.large" ||
    candidate.status === HttpStatus.PAYLOAD_TOO_LARGE ||
    candidate.statusCode === HttpStatus.PAYLOAD_TOO_LARGE;
  if (!isTooLarge) return undefined;

  return new HttpException(
    {
      statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
      code: PAYLOAD_TOO_LARGE_CODE,
      message:
        "Data yang dikirim terlalu besar — kecilkan ukuran file atau foto lalu coba lagi.",
    },
    HttpStatus.PAYLOAD_TOO_LARGE,
  );
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(rawException: unknown, host: ArgumentsHost): void {
    // A body-parser overflow arrives as a bare Error; everything below treats
    // it as the 413 HttpException it should have been all along.
    const exception = asPayloadTooLarge(rawException) ?? rawException;

    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const requestId = request.headers["x-request-id"] as string | undefined;

    if (status >= 500) {
      this.logger.error(
        { requestId, path: request.url, status },
        exception instanceof Error ? exception.message : "Unexpected error",
      );
    }

    const code =
      exception instanceof HttpException && status < 500
        ? extractCode(exception)
        : undefined;

    response.status(status).json({
      statusCode: status,
      requestId,
      // 5xx and non-HTTP exceptions stay generic — never leak internals.
      message:
        exception instanceof HttpException
          ? extractMessage(exception)
          : "Internal server error",
      ...(code ? { code } : {}),
    });
  }
}
