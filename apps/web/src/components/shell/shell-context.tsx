"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type ShellState = {
  txnOpen: boolean;
  setTxnOpen: (v: boolean) => void;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
  /**
   * EPIC-023 Task H3 (D22) — reviewed foundation exception: this file is
   * protected per WM_CONVENTIONS.md, but the open/close flag for the
   * onboarding walkthrough can only live in the cross-page shell context
   * (the "Mulai Setup Terpandu" trigger on /akun and the sidebar's tour
   * entry point both need to open it). Was the button-spotlight tour's
   * `tourStep`/`nextTourStep`/`prevTourStep` — dropped because
   * `components/onboarding/guided-setup.tsx` (the tour's replacement)
   * manages its own step/resume state, keyed by real created-row ids, not
   * a bare step index.
   */
  tourOpen: boolean;
  startTour: () => void;
  endTour: () => void;
};

const ShellContext = createContext<ShellState | null>(null);

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [txnOpen, setTxnOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  const startTour = useCallback(() => setTourOpen(true), []);
  const endTour = useCallback(() => setTourOpen(false), []);

  const value = useMemo(
    () => ({
      txnOpen,
      setTxnOpen,
      searchOpen,
      setSearchOpen,
      tourOpen,
      startTour,
      endTour,
    }),
    [txnOpen, searchOpen, tourOpen, startTour, endTour],
  );

  return (
    <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
  );
}

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used within ShellProvider");
  return ctx;
}
