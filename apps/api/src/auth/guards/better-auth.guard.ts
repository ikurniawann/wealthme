import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { IS_PUBLIC_KEY } from "../../common/decorators/public.decorator";
import { PrismaService } from "../../prisma/prisma.service";

import type { Request } from "express";

@Injectable()
export class BetterAuthGuard implements CanActivate {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException();

    const session = await this.prisma.baSession.findUnique({
      where: { token },
      include: { user: { select: { email: true } } },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException();
    }

    (request as unknown as Record<string, unknown>).user = {
      sub: session.userId,
      email: session.user.email,
    };

    return true;
  }

  private extractToken(request: Request): string | null {
    const auth = request.headers["authorization"];
    if (!auth?.startsWith("Bearer ")) return null;
    return auth.slice(7);
  }
}
