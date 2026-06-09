import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session extends DefaultSession {
    accessToken?: string;
    familyGroupId?: string | null;
    userId?: string;
    error?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    familyGroupId?: string | null;
    refreshToken?: string;
    userId?: string;
    accessTokenExpiresAt?: number;
    error?: string;
  }
}
