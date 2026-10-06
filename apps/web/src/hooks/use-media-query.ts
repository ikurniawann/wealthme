"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Live `matchMedia` match (false on the server and where matchMedia is
 * missing). Prefer CSS for pure styling; use this only when the DOM itself
 * must differ (e.g. one control instead of two hidden duplicates).
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  const snapshot = () =>
    typeof window.matchMedia === "function" && window.matchMedia(query).matches;
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
