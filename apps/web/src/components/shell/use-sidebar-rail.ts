"use client";

import { useCallback, useSyncExternalStore } from "react";

export type SidebarPref = "auto" | "collapsed" | "expanded";

const KEY = "wm.sidebar";
const EVENT = "wm:sidebar";
/** Widths that default to the icon rail (prototype: 901-1439px). */
const RAIL_QUERY = "(min-width: 901px) and (max-width: 1439px)";

function readPref(): SidebarPref {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "collapsed" || value === "expanded" ? value : "auto";
  } catch {
    return "auto";
  }
}

/** Whether the sidebar shows as the icon rail: the member's choice, else the width default. */
export function resolveRail(pref: SidebarPref, railWidth: boolean): boolean {
  return pref === "collapsed" || (pref === "auto" && railWidth);
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia(RAIL_QUERY);
  media.addEventListener("change", onChange);
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const snapshot = () =>
  resolveRail(readPref(), window.matchMedia(RAIL_QUERY).matches);

/**
 * Collapse / expand for the hub sidebar, persisted per browser. The server
 * render assumes the full sidebar; the client corrects it on hydrate.
 */
export function useSidebarRail() {
  const rail = useSyncExternalStore(subscribe, snapshot, () => false);
  const toggle = useCallback(() => {
    try {
      window.localStorage.setItem(KEY, rail ? "expanded" : "collapsed");
    } catch {
      /* private mode: the toggle still applies until reload */
    }
    window.dispatchEvent(new Event(EVENT));
  }, [rail]);
  return { rail, toggle };
}
