import { Injectable, UnauthorizedException } from "@nestjs/common";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { RedisService } from "../../redis/redis.service";

import type { JwtPayload } from "./jwt.strategy";
import type { Env } from "../../config/env";
import type { Request } from "express";

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  "jwt-refresh",
) {
  constructor(
    config: ConfigService<Env, true>,
    private readonly redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField("refreshToken"),
      ignoreExpiration: false,
      secretOrKey: config.get("JWT_REFRESH_SECRET", { infer: true }),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<JwtPayload> {
    const refreshToken = (req.body as { refreshToken?: string }).refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token missing");
    }

    const stored = await this.redis.get(`refresh:${payload.sub}`);
    if (stored !== refreshToken) {
      throw new UnauthorizedException("Refresh token invalid or rotated");
    }

    return payload;
  }
}
