"use client";

// A1 (revisi-2) — mounts `useAiChatEngine()` ONCE, above any single page, so
// the floating launcher (always mounted in the shell) and the full `/ai`
// page read and write the exact same transcript instead of drifting into
// two independent conversations. Also carries the floating launcher's own
// open/closed UI state, since that too must survive a route change (closing
// the panel to click a link elsewhere in the app shouldn't reopen it).

import * as React from "react";
import { type AiChatEngine, useAiChatEngine } from "@/hooks/use-ai-chat-engine";

type AiChatContextValue = AiChatEngine & {
  launcherOpen: boolean;
  setLauncherOpen: (open: boolean) => void;
};

const AiChatContext = React.createContext<AiChatContextValue | null>(null);

export function AiChatProvider({ children }: { children: React.ReactNode }) {
  const engine = useAiChatEngine();
  const [launcherOpen, setLauncherOpen] = React.useState(false);

  // `engine` is already a fresh object every render (it's a plain hook
  // return value, not itself memoized), so wrapping this in `useMemo` would
  // buy nothing — every dependency changes whenever the object we'd memoize
  // does.
  const value: AiChatContextValue = {
    ...engine,
    launcherOpen,
    setLauncherOpen,
  };

  return (
    <AiChatContext.Provider value={value}>{children}</AiChatContext.Provider>
  );
}

export function useAiChat(): AiChatContextValue {
  const ctx = React.useContext(AiChatContext);
  if (!ctx) throw new Error("useAiChat must be used within AiChatProvider");
  return ctx;
}
