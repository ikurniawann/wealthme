"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

/**
 * EPIC-026 shell migration — desktop sidebar collapse.
 *
 * `design-system.css` (the verbatim prototype port) already ships every
 * `.sidebar[data-collapsed="true"]` rule, so this hook only has to supply two
 * things: the attribute value, and the `--sidebar-w` custom property that
 * `.sidebar { width }` and `.main { margin-left }` read.
 *
 * SSR safety: the preference lives in `localStorage`, which is an external
 * store, so it is read through `useSyncExternalStore` with an explicit
 * `getServerSnapshot`. Server render and the hydration render both see the
 * expanded default (`false`) — there is no hydration mismatch — and React
 * re-renders with the stored value immediately after hydration. Nothing reads
 * `localStorage` from a component body.
 */

export const SIDEBAR_COLLAPSE_STORAGE_KEY = "wm.sidebarCollapsed";

export const SIDEBAR_WIDTH_EXPANDED = "248px";
export const SIDEBAR_WIDTH_COLLAPSED = "72px";

/**
 * `--topbar-h` sizes `.topbar` and `.sidebar__brand`. The prototype declares
 * it in `tokens.css`; the app's `globals.css` (protected) never ported it, so
 * the shell supplies it alongside `--sidebar-w` rather than editing tokens.
 */
export const TOPBAR_HEIGHT = "60px";

function readStoredCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY) === "true";
  } catch {
    // Private mode / storage disabled — collapse simply won't persist.
    return false;
  }
}

/* `useSyncExternalStore` requires a cached snapshot: returning a freshly read
   value on every call is fine for a primitive, but caching also keeps the
   number of `localStorage` reads at one per change. */
let cachedCollapsed: boolean | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== SIDEBAR_COLLAPSE_STORAGE_KEY)
      return;
    cachedCollapsed = readStoredCollapsed();
    emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): boolean {
  if (cachedCollapsed === null) cachedCollapsed = readStoredCollapsed();
  return cachedCollapsed;
}

/** Expanded on the server and during hydration — see the SSR note above. */
function getServerSnapshot(): boolean {
  return false;
}

function setCollapsed(next: boolean): void {
  cachedCollapsed = next;
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, String(next));
  } catch {
    // Persistence is best-effort, never load-bearing.
  }
  emit();
}

export type SidebarCollapse = {
  collapsed: boolean;
  toggle: () => void;
};

export function useSidebarCollapse(): SidebarCollapse {
  const collapsed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // Mirror onto <html> so shell parts rendered through a portal (the mobile
  // nav sheet) resolve the same values as the in-tree `.app` subtree.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(
      "--sidebar-w",
      collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED,
    );
    root.style.setProperty("--topbar-h", TOPBAR_HEIGHT);
  }, [collapsed]);

  const toggle = useCallback(() => setCollapsed(!getSnapshot()), []);

  return { collapsed, toggle };
}
