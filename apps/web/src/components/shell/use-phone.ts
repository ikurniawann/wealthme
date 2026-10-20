"use client";

import { useSyncExternalStore } from "react";

/** The phone breakpoint every shell rule uses (bento.css `max-width: 720px`). */
export const PHONE_QUERY = "(max-width: 720px)";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia(PHONE_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function snapshot(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia
    ? window.matchMedia(PHONE_QUERY).matches
    : false;
}

/**
 * Whether the viewport is phone-sized (≤720px). False on the server and in
 * environments without `matchMedia`, so desktop markup is the default and a
 * phone only swaps in its variant after hydration.
 */
export function usePhone(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
