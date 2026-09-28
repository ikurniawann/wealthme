"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * A8 (revisi-2) — "Back" button in the page header: go back only when there
 * is in-app history to return to, otherwise land on /beranda. Browser
 * `history.length` also counts navigations from outside the app (a fresh tab
 * still reports 1, but so does a hard refresh mid-session), so this tracks
 * in-app route changes in `sessionStorage` instead — reset per tab,
 * incremented on every distinct pathname the app renders, decremented when
 * the button is used.
 */
const NAV_DEPTH_KEY = "wm.navDepth";

function readDepth(): number {
  try {
    const raw = window.sessionStorage.getItem(NAV_DEPTH_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeDepth(n: number): void {
  try {
    window.sessionStorage.setItem(NAV_DEPTH_KEY, String(n));
  } catch {
    // storage may be unavailable (private mode); the button just always
    // falls back to /beranda in that case.
  }
}

export function useAppBack() {
  const pathname = usePathname();
  const router = useRouter();
  const prevPathname = useRef<string | null>(null);
  const [depth, setDepth] = useState<number>(() =>
    typeof window === "undefined" ? 0 : readDepth(),
  );

  useEffect(() => {
    if (prevPathname.current === null) {
      // First render after mount: this is where the tab/app currently is,
      // not a navigation — don't count it.
      prevPathname.current = pathname;
      return;
    }
    if (prevPathname.current !== pathname) {
      const next = readDepth() + 1;
      writeDepth(next);
      setDepth(next);
      prevPathname.current = pathname;
    }
  }, [pathname]);

  const goBack = useCallback(() => {
    if (depth > 0) {
      const next = depth - 1;
      writeDepth(next);
      setDepth(next);
      router.back();
    } else {
      router.push("/beranda");
    }
  }, [depth, router]);

  return { canGoBack: depth > 0, goBack };
}
