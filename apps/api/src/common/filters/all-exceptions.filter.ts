import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";

import type { Request, Response } from "express";

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
      message:
        exception instanceof HttpException
          ? exception.message
          : "Internal server error",
    });
  }
}
