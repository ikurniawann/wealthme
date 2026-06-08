"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "wealthme-auth";

type AuthState = {
  isAuthenticated: boolean;
  ready: boolean;
  login: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Read persisted auth after mount to avoid SSR/client hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsAuthenticated(localStorage.getItem(STORAGE_KEY) === "1");
    setReady(true);
  }, []);

  const login = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "1");
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setIsAuthenticated(false);
  }, []);

  const value = useMemo(
    () => ({ isAuthenticated, ready, login, logout }),
    [isAuthenticated, ready, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
