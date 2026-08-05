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

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
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
