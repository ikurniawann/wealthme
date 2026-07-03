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

    response.status(status).json({
      statusCode: status,
      requestId,
      // 5xx and non-HTTP exceptions stay generic — never leak internals.
      message:
        exception instanceof HttpException
          ? extractMessage(exception)
          : "Internal server error",
    });
  }
}
