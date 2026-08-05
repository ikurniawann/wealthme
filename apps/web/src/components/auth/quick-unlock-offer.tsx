"use client";

import { useEffect, useState } from "react";

import { useSession } from "@/lib/auth-compat";
import { readStoredDevice } from "./device-storage";
import { QuickUnlockPrompt } from "./quick-unlock-prompt";

// Per-tab-session flag (not localStorage) — the prompt should reappear on a
// genuinely new sign-in/session, but not re-nag on every route change or
// page refresh within the same browser session once the user has seen it
// once (whether they set up a PIN or chose "Not now").
const ASKED_SESSION_KEY = "wm.deviceUnlockOffered";

/**
 * EPIC-023 D2 (US-FAM-13, D7) — mounts the "set up quick unlock?" prompt
 * once per authenticated session, for a device that has no stored
 * deviceSecret yet (i.e. genuinely hasn't been offered/set up before on this
 * browser). Mounted inside `(app)/layout.tsx` — after `ForcePasswordChangeGuard`
 * — rather than hooked into the login page's own submit handlers, so both the
 * email and username login paths (which each hard-navigate on success) get
 * this offer without duplicating trigger logic between them.
 */
export function QuickUnlockOffer() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);

  // sessionStorage/localStorage reads are only reachable client-side and
  // depend on the session having resolved — this genuinely needs an effect,
  // not a derivable render value (matches theme-toggle.tsx's own
  // mount-detection pattern for the same reason).
  useEffect(() => {
    if (status !== "authenticated" || !session?.userId) return;
    if (typeof window === "undefined") return;

    const alreadyAsked = window.sessionStorage.getItem(ASKED_SESSION_KEY);
    if (alreadyAsked) return;

    const hasStoredDevice = readStoredDevice(session.userId) !== null;
    if (hasStoredDevice) return;

    window.sessionStorage.setItem(ASKED_SESSION_KEY, "1");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
  }, [status, session?.userId]);

  if (!session?.userId) return null;

  return (
    <QuickUnlockPrompt
      userId={session.userId}
      open={open}
      onOpenChange={setOpen}
    />
  );
}
