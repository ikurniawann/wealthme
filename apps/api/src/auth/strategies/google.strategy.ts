import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
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

// Base class used when Google credentials are absent. Registers a no-op
// "google" strategy so Passport boots without error; validate() always rejects.
class GoogleStrategyDisabled extends PassportStrategy(
  // Use a minimal stub strategy that accepts any clientID to avoid the
  // passport-google-oauth20 validation error when credentials are absent.
  // We extend the real Strategy with dummy values — passport never calls
  // authenticate() for the "google" name unless a route triggers it.
  Strategy,
  "google",
) {
  private readonly logger = new Logger("GoogleStrategy");

  constructor() {
    super({
      clientID: "disabled",
      clientSecret: "disabled",
      callbackURL: "http://localhost:4000/auth/google/callback",
      scope: ["email", "profile"],
    });
    this.logger.warn(
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set — Google OAuth disabled",
    );
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    _profile: Profile,
    done: VerifyCallback,
  ): void {
    done(
      new UnauthorizedException(
        "Google OAuth is not configured on this server",
      ),
      false as never,
    );
  }
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(config: ConfigService<Env, true>) {
    const clientID = config.get("GOOGLE_CLIENT_ID", { infer: true });
    const clientSecret = config.get("GOOGLE_CLIENT_SECRET", { infer: true });
    // Use || (not ??) — ConfigService falls back to process.env which may be ""
    // (empty string from .env placeholder). Empty string is falsy, so || provides
    // the placeholder that lets passport register without throwing.
    super({
      clientID: clientID || "disabled",
      clientSecret: clientSecret || "disabled",
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

// Re-export a factory so AuthModule can use a conditional provider.
export { GoogleStrategyDisabled };
