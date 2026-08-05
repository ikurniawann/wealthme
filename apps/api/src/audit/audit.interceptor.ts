import {
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import { type Observable } from "rxjs";
import { catchError, tap } from "rxjs/operators";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AuditService } from "./audit.service";

import type { Request } from "express";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const ACTION_MAP: Record<string, string> = {
  POST: "create",
  PUT: "update",
  PATCH: "update",
  DELETE: "delete",
};

const SENSITIVE_KEYS = new Set([
  "password",
  "newPassword",
  "currentPassword",
  "passwordHash",
  "pin",
  "pinHash",
  "secret",
  // EPIC-023 D2 (US-FAM-13, D7) — POST /auth/devices returns the raw,
  // one-time `deviceSecret` (the "possession" factor of the device-bound
  // PIN-unlock scheme). This is an EXACT-match Set (see `sanitize` below),
  // so a camelCase key like this one needs its own literal entry — it does
  // NOT fall under the generic "secret" entry above. Confirmed missing by
  // security-reviewer AND adversarial-reviewer (mutation testing) before
  // this fix: without it, the raw secret was persisted in plaintext into
  // `AuditLog.after`.
  "deviceSecret",
  "deviceSecretHash",
  "token",
  "accessToken",
  "refreshToken",
  "creditCard",
  "cvv",
  "ssn",
  "apiKey",
]);

function sanitize(obj: unknown): Record<string, unknown> {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return {};
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>)
      .filter(([k]) => !SENSITIVE_KEYS.has(k))
      .map(([k, v]) => [
        k,
        v !== null && typeof v === "object" && !Array.isArray(v)
          ? sanitize(v)
          : v,
      ]),
  );
}

function deriveEntity(url: string): string {
  const segment = url.split("/").filter(Boolean)[0] ?? "unknown";
  const base = segment.charAt(0).toUpperCase() + segment.slice(1);
  // Simple singularization: strip trailing "s" (e.g. accounts → account → Account)
  return base.endsWith("s") ? base.slice(0, -1) : base;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const method = req.method.toUpperCase();

    if (!MUTATING_METHODS.has(method)) {
      return next.handle();
    }

    const tenantCtx = req.tenantContext;
    if (!tenantCtx?.userId) {
      return next.handle();
    }

    const { userId, familyGroupId } = tenantCtx;
    const action = ACTION_MAP[method] ?? method.toLowerCase();
    const entity = deriveEntity(req.path);
    const entityId = (req.params as Record<string, string>)["id"] as
      | string
      | undefined;
    const ipAddress = req.ip;
    const userAgent = req.headers["user-agent"];

    const before =
      method === "PUT" || method === "PATCH" || method === "DELETE"
        ? sanitize(req.body)
        : undefined;

    return next.handle().pipe(
      tap((responseBody: unknown) => {
        this.auditService
          .log({
            userId,
            familyGroupId: familyGroupId ?? undefined,
            action,
            entity,
            entityId,
            before,
            after:
              responseBody !== undefined ? sanitize(responseBody) : undefined,
            ipAddress,
            userAgent,
          })
          .catch((logErr: unknown) => {
            this.logger.error("Failed to write audit log", {
              error: logErr instanceof Error ? logErr.message : String(logErr),
            });
          });
      }),
      catchError((err: unknown) => {
        void this.auditService
          .log({
            userId,
            familyGroupId: familyGroupId ?? undefined,
            action: `${method.toLowerCase()}:error`,
            entity,
            entityId,
            before,
            ipAddress,
            userAgent,
          })
          .catch((logErr: unknown) => {
            this.logger.error("Failed to write error audit log", {
              error: logErr instanceof Error ? logErr.message : String(logErr),
            });
          });
        throw err;
      }),
    );
  }
}
