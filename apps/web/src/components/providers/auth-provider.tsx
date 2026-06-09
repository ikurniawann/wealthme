"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { createContext, useContext, useMemo } from "react";

type AuthState = {
  isAuthenticated: boolean;
  ready: boolean;
  login: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();

  const value = useMemo<AuthState>(
    () => ({
      isAuthenticated: status === "authenticated",
      ready: status !== "loading",
      login: () => signIn(),
      logout: () => signOut({ callbackUrl: "/login" }),
    }),
    [status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
