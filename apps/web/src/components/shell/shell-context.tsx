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
  /** Onboarding spotlight tour — see components/onboarding/walkthrough.tsx. */
  tourOpen: boolean;
  tourStep: number;
  startTour: () => void;
  nextTourStep: () => void;
  prevTourStep: () => void;
  endTour: () => void;
};

const ShellContext = createContext<ShellState | null>(null);

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [txnOpen, setTxnOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  const startTour = useCallback(() => {
    setTourStep(0);
    setTourOpen(true);
  }, []);
  const nextTourStep = useCallback(() => setTourStep((s) => s + 1), []);
  const prevTourStep = useCallback(
    () => setTourStep((s) => Math.max(0, s - 1)),
    [],
  );
  const endTour = useCallback(() => setTourOpen(false), []);

  const value = useMemo(
    () => ({
      txnOpen,
      setTxnOpen,
      searchOpen,
      setSearchOpen,
      tourOpen,
      tourStep,
      startTour,
      nextTourStep,
      prevTourStep,
      endTour,
    }),
    [
      txnOpen,
      searchOpen,
      tourOpen,
      tourStep,
      startTour,
      nextTourStep,
      prevTourStep,
      endTour,
    ],
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
