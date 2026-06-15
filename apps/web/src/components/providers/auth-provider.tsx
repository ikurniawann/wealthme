"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { shouldClearCacheOnUserChange } from "@/lib/auth-session";

type AuthState = {
  isAuthenticated: boolean;
  ready: boolean;
  login: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { status, data: session } = useSession();
  const queryClient = useQueryClient();
  const prevUserId = useRef<string | null>(null);

  useEffect(() => {
    const currentUserId =
      (session?.user as { id?: string } | undefined)?.id ?? null;
    if (shouldClearCacheOnUserChange(prevUserId.current, currentUserId)) {
      queryClient.clear();
    }
    prevUserId.current = currentUserId;
  }, [session?.user, queryClient]);

  const value = useMemo<AuthState>(
    () => ({
      isAuthenticated: status === "authenticated",
      ready: status !== "loading",
      login: () => signIn(),
      logout: () => {
        queryClient.clear();
        void signOut({ callbackUrl: "/login" });
      },
    }),
    [status, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
