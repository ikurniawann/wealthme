"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { authClient } from "@/lib/auth-client";
import { shouldClearCacheOnUserChange } from "@/lib/auth-session";

type AuthState = {
  isAuthenticated: boolean;
  ready: boolean;
  login: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data, isPending } = authClient.useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const prevUserId = useRef<string | null>(null);

  const status = isPending
    ? "loading"
    : data
      ? "authenticated"
      : "unauthenticated";

  useEffect(() => {
    const currentUserId = data?.user.id ?? null;
    if (shouldClearCacheOnUserChange(prevUserId.current, currentUserId)) {
      queryClient.clear();
    }
    prevUserId.current = currentUserId;
  }, [data?.user.id, queryClient]);

  const value = useMemo<AuthState>(
    () => ({
      isAuthenticated: status === "authenticated",
      ready: status !== "loading",
      login: () => {
        router.push("/login");
      },
      logout: () => {
        queryClient.clear();
        void authClient.signOut({
          fetchOptions: {
            onSuccess: () => router.push("/login"),
          },
        });
      },
    }),
    [status, queryClient, router],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
