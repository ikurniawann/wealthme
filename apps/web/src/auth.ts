import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const res = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });
          if (!res.ok) return null;
          const tokens = (await res.json()) as {
            accessToken: string;
            refreshToken: string;
          };
          const meRes = await fetch(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
          });
          if (!meRes.ok) return null;
          const user = (await meRes.json()) as {
            id: string;
            email: string;
            name: string;
            familyGroupId?: string | null;
          };
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            familyGroupId: user.familyGroupId ?? null,
          };
        } catch {
          return null;
        }
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: { params: { scope: "openid email profile" } },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign-in via credentials
      if (user) {
        token.accessToken = (user as { accessToken?: string }).accessToken;
        token.refreshToken = (user as { refreshToken?: string }).refreshToken;
        token.userId = user.id;
        token.familyGroupId =
          (user as { familyGroupId?: string | null }).familyGroupId ?? null;
        token.accessTokenExpiresAt = Date.now() + ACCESS_TOKEN_TTL_MS;
        return token;
      }

      // Initial sign-in via Google
      if (account?.provider === "google" && account.access_token) {
        try {
          const res = await fetch(`${API_URL}/auth/google/callback`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ access_token: account.access_token }),
          });
          if (res.ok) {
            const tokens = (await res.json()) as {
              accessToken: string;
              refreshToken: string;
            };
            token.accessToken = tokens.accessToken;
            token.refreshToken = tokens.refreshToken;
            token.accessTokenExpiresAt = Date.now() + ACCESS_TOKEN_TTL_MS;
            try {
              const meRes = await fetch(`${API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${tokens.accessToken}` },
              });
              if (meRes.ok) {
                const me = (await meRes.json()) as {
                  id?: string;
                  familyGroupId?: string | null;
                };
                token.userId = me.id;
                token.familyGroupId = me.familyGroupId ?? null;
              }
            } catch {
              /* familyGroupId remains unset */
            }
          }
        } catch {
          /* keep existing token */
        }
        return token;
      }

      // Subsequent calls — check expiry
      if (Date.now() < (token.accessTokenExpiresAt as number)) {
        return token;
      }

      // Token expired — attempt refresh
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: token.refreshToken }),
        });
        if (!res.ok) throw new Error("Refresh failed");
        const data = (await res.json()) as {
          accessToken: string;
          refreshToken: string;
        };
        return {
          ...token,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          accessTokenExpiresAt: Date.now() + ACCESS_TOKEN_TTL_MS,
          error: undefined,
        };
      } catch {
        return { ...token, error: "RefreshTokenError" };
      }
    },
    async session({ session, token }) {
      return {
        ...session,
        accessToken: token.accessToken as string | undefined,
        userId: token.userId as string | undefined,
        familyGroupId: token.familyGroupId as string | null | undefined,
        error: token.error as string | undefined,
      };
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: { strategy: "jwt" },
});
