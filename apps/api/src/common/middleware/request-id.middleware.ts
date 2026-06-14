import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";

import type { NextFunction, Request, Response } from "express";

@Injectable()
export class RequestIdMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId =
      (req.headers["x-request-id"] as string | undefined) ?? randomUUID();
    req.headers["x-request-id"] = requestId;
    res.setHeader("X-Request-Id", requestId);
    next();
  }
}
