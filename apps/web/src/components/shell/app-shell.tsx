"use client";

import { Suspense, useEffect, useMemo } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { useLocale } from "@/hooks/use-locale";
import { ShellProvider } from "./shell-context";
import { SidebarNav } from "./sidebar";
import { Topbar } from "./topbar";
import { MobileNav } from "./mobile-bars";
import { SearchDialog } from "./search-dialog";
import { TransactionDialog } from "./transaction-dialog";
import { Walkthrough } from "@/components/onboarding/walkthrough";
import {
  SIDEBAR_WIDTH_COLLAPSED,
  SIDEBAR_WIDTH_EXPANDED,
  TOPBAR_HEIGHT,
  useSidebarCollapse,
} from "./use-sidebar-collapse";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, ready } = useAuth();
  const router = useRouter();
  const { t } = useLocale();
  const { collapsed, toggle } = useSidebarCollapse();

  // The same two custom properties the hook mirrors onto <html>, applied
  // in-tree so the very first paint of the shell is already correctly sized
  // (an effect-only write can land after the browser has painted).
  const shellVars = useMemo(
    () =>
      ({
        "--sidebar-w": collapsed
          ? SIDEBAR_WIDTH_COLLAPSED
          : SIDEBAR_WIDTH_EXPANDED,
        "--topbar-h": TOPBAR_HEIGHT,
      }) as CSSProperties,
    [collapsed],
  );

  useEffect(() => {
    if (ready && !isAuthenticated) router.replace("/login");
  }, [ready, isAuthenticated, router]);

  if (!ready || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2.5 text-muted-foreground">
          <div className="sidebar__logo">
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed small brand mark, no responsive srcset needed */}
            <img
              src="/brand/wealthme-mark.png"
              alt=""
              className="size-full object-contain"
            />
          </div>
          <span className="t-md t-bold">{t.shell.loading}</span>
        </div>
      </div>
    );
  }

  return (
    <ShellProvider>
      <div className="app" style={shellVars}>
        <Suspense fallback={null}>
          <SidebarNav collapsed={collapsed} onToggleCollapse={toggle} />
        </Suspense>

        <div className="main">
          <Suspense fallback={null}>
            <Topbar />
          </Suspense>
          <main className="page" id="main-content">
            {children}
          </main>
        </div>

        <MobileNav />
      </div>

      <SearchDialog />
      <TransactionDialog />
      <Walkthrough />
    </ShellProvider>
  );
}
