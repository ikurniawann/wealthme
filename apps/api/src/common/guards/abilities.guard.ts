import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { Reflector } from "@nestjs/core";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CaslAbilityFactory } from "../../casl/casl-ability.factory";
import {
  CHECK_ABILITY_KEY,
  type PolicyHandler,
} from "../decorators/check-ability.decorator";

import type { Request } from "express";

@Injectable()
export class AbilitiesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const handlers = this.reflector.getAllAndOverride<PolicyHandler[]>(
      CHECK_ABILITY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!handlers || handlers.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const tenantContext = req.tenantContext;

    if (!tenantContext?.member) {
      throw new ForbiddenException("Access denied");
    }

    const ability = this.caslAbilityFactory.createForMember(
      tenantContext.member,
      tenantContext.access,
    );

    const allAllowed = handlers.every((handler) => handler(ability));
    if (!allAllowed) {
      throw new ForbiddenException("Access denied");
    }

    return true;
  }
}
