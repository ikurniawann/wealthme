import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

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
 * Structured fields of a 409 ledger conflict (`InvestmentLedgerConflictDto`
 * in @wealthme/contracts): the failing point, the IDR/unit amounts and the
 * later rows it breaks. Without them the web can only show the raw message
 * ("tersedia Rp 1902850"); with them it formats the amounts for the user's
 * locale and lists the affected rows. Whitelisted by name and forwarded only
 * on a 409 `HttpException`, so nothing else on an exception body leaks.
 */
const CONFLICT_FIELDS = [
  "at",
  "needed",
  "available",
  "unit",
  "conflicts",
] as const;

function extractConflictFields(
  exception: HttpException,
): Partial<Record<(typeof CONFLICT_FIELDS)[number], unknown>> {
  const body = exception.getResponse();
  if (!body || typeof body !== "object") return {};
  const source = body as Record<string, unknown>;
  const fields: Partial<Record<(typeof CONFLICT_FIELDS)[number], unknown>> = {};
  for (const key of CONFLICT_FIELDS) {
    if (source[key] !== undefined) fields[key] = source[key];
  }
  return fields;
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

/**
 * Hardening audit (errors, MEDIUM) — the filter never inspected a raw
 * `PrismaClientKnownRequestError` itself; mapping P2002/P2025/P2003 to a
 * friendly 4xx was opt-in per service, so any service WITHOUT its own
 * mapping (donations, goals, investments, split-bills, transactions, assets,
 * inheritance, …) sent an unhandled constraint violation to the generic 500
 * "Internal server error" branch below instead of an actionable status.
 *
 * Only engages for a genuine, still-unwrapped `PrismaClientKnownRequestError`
 * — a service that already caught and rethrew its own `HttpException` (the
 * `accounts`/`budgets`/… precedent) is left alone, so a per-service mapping
 * always takes precedence over this fallback.
 */
function asPrismaKnownError(exception: unknown): HttpException | undefined {
  if (!(exception instanceof Prisma.PrismaClientKnownRequestError)) {
    return undefined;
  }
  switch (exception.code) {
    case "P2002":
      return new HttpException(
        { statusCode: HttpStatus.CONFLICT, message: "Data sudah ada" },
        HttpStatus.CONFLICT,
      );
    case "P2025":
      return new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          message: "Data tidak ditemukan",
        },
        HttpStatus.NOT_FOUND,
      );
    case "P2003":
      return new HttpException(
        {
          statusCode: HttpStatus.CONFLICT,
          message: "Data masih dipakai/terkait",
        },
        HttpStatus.CONFLICT,
      );
    default:
      return undefined;
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(rawException: unknown, host: ArgumentsHost): void {
    // A body-parser overflow arrives as a bare Error; everything below treats
    // it as the 413 HttpException it should have been all along. An
    // unmapped Prisma constraint violation is normalized the same way, but
    // only after a per-service mapping had its chance to run (it would
    // already have rethrown its own HttpException by the time this filter
    // sees it, so `rawException` would no longer be the raw Prisma error).
    const exception =
      asPayloadTooLarge(rawException) ??
      asPrismaKnownError(rawException) ??
      rawException;

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

    const conflict =
      exception instanceof HttpException && status === HttpStatus.CONFLICT
        ? extractConflictFields(exception)
        : {};

    response.status(status).json({
      statusCode: status,
      requestId,
      // 5xx and non-HTTP exceptions stay generic — never leak internals.
      message:
        exception instanceof HttpException
          ? extractMessage(exception)
          : "Internal server error",
      ...(code ? { code } : {}),
      ...conflict,
    });
  }
}
