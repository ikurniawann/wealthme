"use client";

// ── Privacy ("Sembunyikan nominal") toggle ──────────────────────────────────
// Page-local port of the same pattern already shipped on `aset/page.tsx`
// (D1/US-ASSET-5): per-user localStorage, namespaced the same way as
// device-storage.ts (`wm.<feature>.<userId>`) so one user's preference never
// bleeds into another's on a shared device. Kept page-local because
// `components/wm/*` is a protected foundation directory.
//
// EPIC-026 — the blur itself is now the prototype's own `.is-private .private`
// rule from `design-system.css` (see `ringkasan.html`'s
// `document.body.classList.toggle("is-private")`), applied by putting
// `is-private` on the page root and `private` on each amount.

import { useEffect, useState } from "react";

const RINGKASAN_PRIVACY_STORAGE_PREFIX = "wm.ringkasan-privacy.";

function readStoredPrivacy(userId: string): boolean {
  try {
    return (
      window.localStorage.getItem(
        `${RINGKASAN_PRIVACY_STORAGE_PREFIX}${userId}`,
      ) === "1"
    );
  } catch {
    // storage may be unavailable (private browsing, SSR)
    return false;
  }
}

function writeStoredPrivacy(userId: string, isOn: boolean): void {
  try {
    window.localStorage.setItem(
      `${RINGKASAN_PRIVACY_STORAGE_PREFIX}${userId}`,
      isOn ? "1" : "0",
    );
  } catch {
    // storage may be unavailable — the toggle still works for this session
  }
}

export function useRingkasanPrivacy(userId: string | undefined) {
  const [privacyOn, setPrivacyOn] = useState(false);

  useEffect(() => {
    if (!userId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrivacyOn(readStoredPrivacy(userId));
  }, [userId]);

  function togglePrivacy(): void {
    const next = !privacyOn;
    setPrivacyOn(next);
    if (userId) writeStoredPrivacy(userId, next);
  }

  return { privacyOn, togglePrivacy };
}
