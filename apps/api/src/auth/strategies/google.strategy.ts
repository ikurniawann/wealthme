import { Injectable, UnauthorizedException } from "@nestjs/common";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import {
  Strategy,
  type Profile,
  type VerifyCallback,
} from "passport-google-oauth20";

import type { Env } from "../../config/env";

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(config: ConfigService<Env, true>) {
    const clientID = config.get("GOOGLE_CLIENT_ID", { infer: true });
    const clientSecret = config.get("GOOGLE_CLIENT_SECRET", { infer: true });
    if (!clientID || !clientSecret) {
      throw new Error(
        "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set to use Google OAuth",
      );
    }
    super({
      clientID,
      clientSecret,
      callbackURL: config.get("GOOGLE_CALLBACK_URL", { infer: true }),
      scope: ["email", "profile"],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const emailEntry = profile.emails?.[0];
    if (!emailEntry?.value) {
      return done(
        new UnauthorizedException("Google account has no verified email"),
        false as never,
      );
    }
    // passport-google-oauth20 types: emailEntry.verified may be boolean or string 'true'
    const isVerified =
      emailEntry.verified === true ||
      (emailEntry as { verified?: unknown }).verified === "true";
    // Only enforce verification if the field is present (some Google profiles omit it)
    if (emailEntry.verified !== undefined && !isVerified) {
      return done(
        new UnauthorizedException("Google account email is not verified"),
        false as never,
      );
    }
    const email = emailEntry.value;
    done(null, {
      googleId: profile.id,
      email,
      name: profile.displayName,
    } satisfies GoogleProfile);
  }
}
