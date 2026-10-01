import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";

import { assertBalancesVisible } from "../utils/balance-visibility.util";

import type { Request } from "express";

/**
 * "Lihat saldo" — denies (403 BALANCES_HIDDEN) a whole controller/route whose
 * payload is money aggregates, for a member with the flag off. Runs after the
 * global TenantGuard, which resolves `tenantContext.member.balancesHidden`.
 */
@Injectable()
export class BalancesVisibleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    assertBalancesVisible(req.tenantContext?.member);
    return true;
  }
}
