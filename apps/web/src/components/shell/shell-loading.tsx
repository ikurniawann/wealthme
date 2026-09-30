"use client";

import { useLocale } from "@/hooks/use-locale";
import { BrandMark } from "./sidebar-brand";

/**
 * The one full-screen "loading WealthMe" state. Shared by AppShell and
 * ForcePasswordChangeGuard so the server render and the client hydrate
 * produce identical markup whichever of them is waiting.
 */
export function ShellLoading() {
  const { t } = useLocale();
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--wm-bg)]">
      <div className="flex items-center gap-2.5 text-[var(--wm-muted)]">
        <BrandMark />
        <span className="text-[14px] font-semibold">{t.shell.loading}</span>
      </div>
    </div>
  );
}
