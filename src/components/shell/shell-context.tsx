"use client";

import { createContext, useContext, useMemo, useState } from "react";

type ShellState = {
  txnOpen: boolean;
  setTxnOpen: (v: boolean) => void;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
};

const ShellContext = createContext<ShellState | null>(null);

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [txnOpen, setTxnOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const value = useMemo(
    () => ({ txnOpen, setTxnOpen, searchOpen, setSearchOpen }),
    [txnOpen, searchOpen],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used within ShellProvider");
  return ctx;
}
