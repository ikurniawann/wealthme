import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session extends DefaultSession {
    accessToken?: string;
    userId?: string;
    familyGroupId?: string | null;
    error?: string;
    user: DefaultSession["user"] & {
      memberships?: Array<{ id: string; familyGroupId: string; role: string }>;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    userId?: string;
    familyGroupId?: string | null;
    accessTokenExpiresAt?: number;
    error?: string;
    memberships?: Array<{ id: string; familyGroupId: string; role: string }>;
  }
}
