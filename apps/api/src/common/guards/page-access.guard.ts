import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { Reflector } from "@nestjs/core";

import { resourceAllows, type ResourceKey } from "../../access/resource-access";
import { PAGE_ACCESS_KEY } from "../decorators/page-access.decorator";

import type { Request } from "express";

/**
 * EPIC-030 — enforces the Master's IAM page grants at the API. Runs after
 * TenantGuard (which resolves `tenantContext.access`) and before
 * AbilitiesGuard (CASL).
 *
 *  - Not a family-scoped request (no :familyGroupId) → not this guard's call.
 *  - Master → always allowed.
 *  - Family-scoped route with no @PageAccess → REFUSED (fail closed; unlike
 *    AbilitiesGuard, a forgotten decorator must not open a page the Master
 *    closed).
 */
@Injectable()
export class PageAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const tenant = req.tenantContext;
    if (!tenant?.familyGroupId || !tenant.access) return true;
    if (tenant.access.isMaster) return true;

    const resource = this.reflector.getAllAndOverride<ResourceKey | undefined>(
      PAGE_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!resource || !resourceAllows(tenant.access, resource, req.method)) {
      throw new ForbiddenException({
        message: "Anda tidak punya akses ke halaman ini",
        code: "PAGE_ACCESS_DENIED",
      });
    }
    return true;
  }
}
